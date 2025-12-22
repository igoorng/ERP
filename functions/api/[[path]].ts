// KVNamespace type definition
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

class KVCacheManager {
  constructor(private kv: KVNamespace) {}
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key);
      return value ? JSON.parse(value) : null;
    } catch { return null; }
  }
  async set<T>(key: string, data: T, ttl = 3600): Promise<void> {
    try { await this.kv.put(key, JSON.stringify(data), { expirationTtl: Math.max(60, ttl) }); } catch {}
  }
  async delete(key: string): Promise<void> { try { await this.kv.delete(key); } catch {} }
  async deletePattern(pattern: string): Promise<void> {
    try {
      const list = await this.kv.list({ prefix: pattern });
      await Promise.all(list.keys.map(k => this.kv.delete(k.name)));
    } catch {}
  }
}

export const onRequest: any = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const method = request.method;
  const bypassCache = request.headers.get('X-Cache-Bypass') === 'true';

  const json = (data: any, status = 200) => 
    new Response(JSON.stringify(data), { 
      status, 
      headers: { 'Content-Type': 'application/json' } 
    });

  if (!env.DB) return json({ error: 'Database binding missing' }, 500);
  const cache = env.CACHE_KV ? new KVCacheManager(env.CACHE_KV) : null;

  // 辅助函数：确保 base_unit 列存在
  const ensureBaseUnitColumn = async () => {
    try {
      await env.DB.prepare(`ALTER TABLE "materials" ADD COLUMN "base_unit" TEXT`).run();
    } catch (e) {
      // 忽略列已存在的错误
    }
  };

  try {
    // --- 数据库初始化 ---
    if (path === '/auth/init' && method === 'POST') {
      const sqls = [
        `CREATE TABLE IF NOT EXISTS "users" ("id" TEXT PRIMARY KEY, "username" TEXT UNIQUE, "password_hash" TEXT, "role" TEXT)`,
        `CREATE TABLE IF NOT EXISTS "materials" ("id" TEXT PRIMARY KEY, "name" TEXT, "unit" TEXT, "base_unit" TEXT, "created_at" INTEGER, "deleted_at" INTEGER)`,
        `CREATE TABLE IF NOT EXISTS "inventory" ("id" TEXT PRIMARY KEY, "material_id" TEXT, "date" TEXT, "opening_stock" REAL, "today_inbound" REAL, "workshop_outbound" REAL, "store_outbound" REAL, "remaining_stock" REAL)`,
        `CREATE TABLE IF NOT EXISTS "audit_logs" ("id" TEXT PRIMARY KEY, "user_id" TEXT, "username" TEXT, "action" TEXT, "details" TEXT, "timestamp" TEXT)`,
        `CREATE TABLE IF NOT EXISTS "settings" ("key" TEXT PRIMARY KEY, "value" TEXT)`
      ];
      for (const sql of sqls) {
        await env.DB.prepare(sql).run();
      }
      await ensureBaseUnitColumn();
      
      await env.DB.prepare(`INSERT OR IGNORE INTO "users" ("id", "username", "password_hash", "role") VALUES (?, ?, ?, ?)`).bind('admin-id', 'admin', 'admin', 'admin').run();
      await env.DB.prepare(`INSERT OR IGNORE INTO "settings" ("key", "value") VALUES (?, ?)`).bind('LOW_STOCK_THRESHOLD', '10').run();
      await env.DB.prepare(`INSERT OR IGNORE INTO "settings" ("key", "value") VALUES (?, ?)`).bind('SYSTEM_NAME', '物料管理系统 Pro').run();
      
      return json({ message: 'Initialization successful' });
    }

    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = await request.json() as any;
      const user = await env.DB.prepare(`SELECT id, username, role FROM "users" WHERE username = ? AND password_hash = ?`)
        .bind(username, password).first();
      return user ? json(user) : json({ error: 'Invalid credentials' }, 401);
    }

    // --- 物料管理 API ---
    if (path === '/materials' && method === 'GET') {
      let query = 'SELECT id, name, unit, base_unit AS baseUnit, created_at AS createdAt, deleted_at AS deletedAt FROM "materials" WHERE deleted_at IS NULL';
      const { results } = await env.DB.prepare(query).all();
      return json(results);
    }

    if (path === '/materials/paginated' && method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const search = url.searchParams.get('search') || '';
      const offset = (page - 1) * pageSize;
      
      let where = "WHERE deleted_at IS NULL";
      let params: any[] = [];
      if (search) {
        where += " AND name LIKE ?";
        params.push(`%${search}%`);
      }
      
      const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM "materials" ${where}`).bind(...params).first('count');
      const { results } = await env.DB.prepare(`SELECT id, name, unit, base_unit AS baseUnit, created_at AS createdAt FROM "materials" ${where} ORDER BY name LIMIT ? OFFSET ?`)
        .bind(...params, pageSize, offset).all();
      
      return json({ materials: results || [], total: total || 0, hasMore: offset + (results?.length || 0) < (total || 0) });
    }

    if (path === '/materials' && method === 'POST') {
      const { name, unit, baseUnit, initialStock, date, timestamp } = await request.json() as any;
      const id = crypto.randomUUID();
      
      try {
        await env.DB.prepare(`INSERT INTO "materials" (id, name, unit, base_unit, created_at) VALUES (?, ?, ?, ?, ?)`).bind(id, name, unit, baseUnit, timestamp).run();
      } catch (e: any) {
        if (e.message.includes('base_unit')) {
          await ensureBaseUnitColumn();
          await env.DB.prepare(`INSERT INTO "materials" (id, name, unit, base_unit, created_at) VALUES (?, ?, ?, ?, ?)`).bind(id, name, unit, baseUnit, timestamp).run();
        } else {
          return json({ error: e.message }, 500);
        }
      }

      await env.DB.prepare(`INSERT INTO "inventory" (id, material_id, date, opening_stock, today_inbound, workshop_outbound, store_outbound, remaining_stock) VALUES (?, ?, ?, ?, 0, 0, 0, ?)`).bind(crypto.randomUUID(), id, date, initialStock, initialStock).run();
      
      if (cache) await cache.deletePattern('mf:');
      return json({ id });
    }

    if (path === '/materials/batch-delete' && method === 'POST') {
      const { ids, timestamp } = await request.json() as any;
      if (!Array.isArray(ids) || ids.length === 0) return json({ error: 'No IDs' }, 400);

      const statements = ids.map(id => 
        env.DB.prepare(`UPDATE "materials" SET deleted_at = ? WHERE id = ?`).bind(timestamp, id)
      );
      
      try {
        await env.DB.batch(statements);
        if (cache) await cache.deletePattern('mf:');
        return json({ success: true });
      } catch (e: any) {
        return json({ error: e.message }, 500);
      }
    }

    // --- 库存管理 API ---
    if (path === '/inventory' && method === 'GET') {
      const date = url.searchParams.get('date');
      if (!date) return json({ error: 'Missing date' }, 400);
      
      const { results } = await env.DB.prepare(`
      //  SELECT id, material_id AS materialId, date, opening_stock AS openingStock, today_inbound AS todayInbound, 
      //         workshop_outbound AS workshopOutbound, store_outbound AS storeOutbound, remaining_stock AS remainingStock 
      //  FROM "inventory" WHERE date = ?
      // `).bind(date).all();

      SELECT 
      i.id, i.material_id AS materialId, i.date, 
      i.opening_stock AS openingStock, i.today_inbound AS todayInbound, 
      i.workshop_outbound AS workshopOutbound, i.store_outbound AS storeOutbound, 
      i.remaining_stock AS remainingStock,
      m.name, m.unit, m.base_unit AS baseUnit
      FROM "inventory" i
      JOIN "materials" m ON i.material_id = m.id
      WHERE i.date = ?
      AND m.deleted_at IS NULL
    GROUP BY i.material_id
    `).bind(date).all();
      return json(results || []);
    }

    if (path === '/inventory/paginated' && method === 'GET') {
      const date = url.searchParams.get('date');
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const search = url.searchParams.get('search') || '';
      const offset = (page - 1) * pageSize;
      
      let where = 'WHERE i.date = ? AND m.deleted_at IS NULL';
      let params: any[] = [date];
      if (search) {
        where += " AND m.name LIKE ?";
        params.push(`%${search}%`);
      }

      // const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM "inventory" i JOIN "materials" m ON i.material_id = m.id ${where}`).bind(...params).first('count');
      // const { results } = await env.DB.prepare(`
      //  SELECT i.id, i.material_id AS materialId, i.date, i.opening_stock AS openingStock, i.today_inbound AS todayInbound, i.workshop_outbound AS workshopOutbound, i.store_outbound AS storeOutbound, i.remaining_stock AS remainingStock 
      //  FROM "inventory" i JOIN "materials" m ON i.material_id = m.id ${where} ORDER BY m.name LIMIT ? OFFSET ?
      //`).bind(...params, pageSize, offset).all();

      // 先查总条数（去重后）
      const total = await env.DB.prepare(`
        SELECT COUNT(DISTINCT i.material_id) as count 
        FROM "inventory" i 
        JOIN "materials" m ON i.material_id = m.id 
        ${where}
        `).bind(...params).first('count');

  // 主查询：使用子查询取最新记录（如果当天有多条，只取一条）
      const { results } = await env.DB.prepare(`
        SELECT 
          i.id, i.material_id AS materialId, i.date, 
          i.opening_stock AS openingStock, i.today_inbound AS todayInbound, 
          i.workshop_outbound AS workshopOutbound, i.store_outbound AS storeOutbound, 
          i.remaining_stock AS remainingStock,
          m.name, m.unit, m.base_unit AS baseUnit
          FROM "inventory" i
          JOIN "materials" m ON i.material_id = m.id
          WHERE i.date = ?
          AND m.deleted_at IS NULL
          AND (search ? m.name LIKE ? : 1)
          GROUP BY i.material_id
          ORDER BY m.name
          LIMIT ? OFFSET ?
       `).bind(date, ...(search ? [`%${search}%`] : []), pageSize, offset).all();
      
      return json({ inventory: results || [], total: total || 0, hasMore: offset + (results?.length || 0) < (total || 0) });
    }

    if (path === '/inventory' && method === 'PUT') {
      const record = await request.json() as any;
      await env.DB.prepare(`UPDATE "inventory" SET today_inbound = ?, workshop_outbound = ?, store_outbound = ?, remaining_stock = ? WHERE material_id = ? AND date = ?`)
        .bind(record.todayInbound, record.workshopOutbound, record.storeOutbound, record.remainingStock, record.materialId, record.date).run();
      return json({ success: true });
    }

    if (path === '/inventory/initialize' && method === 'POST') {
      const { date, timestamp } = await request.json() as any;
      const mats = await env.DB.prepare('SELECT id FROM "materials" WHERE created_at <= ? AND deleted_at IS NULL').bind(timestamp).all();
      for (const m of (mats.results as any[])) {
        const exists = await env.DB.prepare('SELECT id FROM "inventory" WHERE material_id = ? AND date = ?').bind(m.id, date).first();
        if (!exists) {
          const last = await env.DB.prepare('SELECT remaining_stock FROM "inventory" WHERE material_id = ? AND date < ? ORDER BY date DESC LIMIT 1').bind(m.id, date).first() as any;
          const open = last ? last.remaining_stock : 0;
          await env.DB.prepare(`INSERT INTO "inventory" (id, material_id, date, opening_stock, today_inbound, workshop_outbound, store_outbound, remaining_stock) VALUES (?, ?, ?, ?, 0, 0, 0, ?)`).bind(crypto.randomUUID(), m.id, date, open, open).run();
        }
      }
      return json({ success: true });
    }

    // --- 统计 API ---
    if (path === '/stats' && method === 'GET') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      if (!start || !end) return json({ error: 'Missing start or end date' }, 400);

      try {
        // 使用更明确的别名以防自连接或相关子查询混淆
        const { results } = await env.DB.prepare(`
          SELECT 
            m.name,
            COALESCE(SUM(i.today_inbound), 0) as totalIn,
            COALESCE(SUM(i.workshop_outbound), 0) as totalWorkshop,
            COALESCE(SUM(i.store_outbound), 0) as totalStore,
            (
              SELECT sub_i.remaining_stock 
              FROM "inventory" sub_i 
              WHERE sub_i.material_id = i.material_id AND sub_i.date <= ? 
              ORDER BY sub_i.date DESC LIMIT 1
            ) as currentStock
          FROM "inventory" i
          JOIN "materials" m ON i.material_id = m.id
          WHERE i.date >= ? AND i.date <= ?
          GROUP BY i.material_id, m.name
        `).bind(end, start, end).all();

        return json(results || []);
      } catch (err: any) {
        return json({ error: `Query execution failed: ${err.message}` }, 500);
      }
    }

    if (path === '/settings' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM "settings"').all();
      return json(results.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {}));
    }

    if (path === '/settings' && method === 'PUT') {
      const settings = await request.json() as any;
      for (const [k, v] of Object.entries(settings)) {
        await env.DB.prepare(`INSERT OR REPLACE INTO "settings" ("key", "value") VALUES (?, ?)`).bind(k, String(v)).run();
      }
      return json({ success: true });
    }

    if (path === '/logs' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM "audit_logs" ORDER BY timestamp DESC LIMIT 100').all();
      return json(results || []);
    }

    if (path === '/logs' && method === 'POST') {
      const log = await request.json() as any;
      await env.DB.prepare(`INSERT INTO "audit_logs" (id, user_id, username, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), log.userId, log.username, log.action, log.details, log.timestamp).run();
      return json({ success: true });
    }

    if (path === '/users' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, username, role FROM "users"').all();
      return json(results || []);
    }

    if (path === '/users' && method === 'POST') {
      const user = await request.json() as any;
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO "users" (id, username, password_hash, role) VALUES (?, ?, ?, ?)`)
        .bind(id, user.username, user.password, user.role).run();
      return json({ id, username: user.username, role: user.role });
    }

    if (path === '/users' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'ID required' }, 400);
      await env.DB.prepare('DELETE FROM "users" WHERE id = ?').bind(id).run();
      return json({ success: true });
    }

    if (path === '/users/password' && method === 'PUT') {
      const { userId, newPassword } = await request.json() as any;
      await env.DB.prepare('UPDATE "users" SET password_hash = ? WHERE id = ?')
        .bind(newPassword, userId).run();
      return json({ success: true });
    }

    if (path === '/cache/clear' && method === 'POST') {
      if (cache) await cache.deletePattern('mf:');
      return json({ success: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e: any) {
    console.error(`API Runtime Error: ${e.message}`, e);
    return json({ error: `Internal Server Error: ${e.message}` }, 500);
  }
};
