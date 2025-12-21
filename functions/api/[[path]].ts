
interface Env {
  DB: any;
}

export const onRequest: any = async (context: any) => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const method = request.method;

  const json = (data: any, status = 200) => 
    new Response(JSON.stringify(data), { 
      status, 
      headers: { 'Content-Type': 'application/json' } 
    });

  if (!env.DB) {
    return json({ error: 'Database binding missing' }, 500);
  }

  try {
    // 1. 初始化与验证
    if (path === '/auth/init' && method === 'POST') {
      const sqls = [
        `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT)`,
        `CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, name TEXT, unit TEXT, created_at INTEGER, deleted_at INTEGER)`,
        `CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY, 
          material_id TEXT, 
          date TEXT, 
          opening_stock REAL, 
          today_inbound REAL, 
          workshop_outbound REAL, 
          store_outbound REAL, 
          remaining_stock REAL
        )`,
        `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TEXT)`,
        `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`
      ];

      for (const sql of sqls) {
        await env.DB.prepare(sql).run();
      }

      await env.DB.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)")
        .bind('admin-id', 'admin', 'admin', 'admin').run();
      
      await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
        .bind('SYSTEM_NAME', 'MaterialFlow Pro').run();
      await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
        .bind('LOW_STOCK_THRESHOLD', '10').run();

      return json({ message: 'Database initialized successfully' });
    }

    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = await request.json() as any;
      const user = await env.DB.prepare("SELECT id, username, role FROM users WHERE username = ? AND password_hash = ?")
        .bind(username, password).first();
      return user ? json(user) : json({ error: 'Unauthorized' }, 401);
    }

    // 2. 物料 (Materials) - 使用 AS 映射
    if (path === '/materials' && method === 'GET') {
      const timestamp = url.searchParams.get('timestamp');
      let query = "SELECT id, name, unit, created_at AS createdAt, deleted_at AS deletedAt FROM materials";
      let params: any[] = [];

      if (timestamp) {
        query += " WHERE created_at <= ? AND (deleted_at IS NULL OR deleted_at > ?)";
        params = [parseInt(timestamp), parseInt(timestamp)];
      } else {
        query += " WHERE deleted_at IS NULL";
      }

      const { results } = await env.DB.prepare(query).bind(...params).all();
      return json(results);
    }

    if (path === '/materials' && method === 'POST') {
      const { name, unit, initialStock, date, timestamp } = await request.json() as any;
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO materials (id, name, unit, created_at) VALUES (?, ?, ?, ?)")
        .bind(id, name, unit, timestamp).run();
      await env.DB.prepare("INSERT INTO inventory (id, material_id, date, opening_stock, today_inbound, workshop_outbound, store_outbound, remaining_stock) VALUES (?, ?, ?, ?, 0, 0, 0, ?)")
        .bind(crypto.randomUUID(), id, date, initialStock, initialStock).run();
      
      return json({ id, name, unit, createdAt: timestamp });
    }

    if (path === '/materials/batch-delete' && method === 'POST') {
      const { ids, timestamp } = await request.json() as any;
      for (const id of ids) {
        await env.DB.prepare("UPDATE materials SET deleted_at = ? WHERE id = ?").bind(timestamp, id).run();
      }
      return json({ success: true });
    }

    // 3. 库存 (Inventory) - 使用 AS 映射字段名
    if (path === '/inventory' && method === 'GET') {
      const date = url.searchParams.get('date');
      const timestamp = url.searchParams.get('timestamp') || Date.now().toString();
      const { results } = await env.DB.prepare(`
        SELECT i.id, i.material_id AS materialId, i.date, 
        i.opening_stock AS openingStock, 
        i.today_inbound AS todayInbound, 
        i.workshop_outbound AS workshopOutbound, 
        i.store_outbound AS storeOutbound, 
        i.remaining_stock AS remainingStock 
        FROM inventory i
        INNER JOIN materials m ON i.material_id = m.id
        WHERE i.date = ? AND (m.deleted_at IS NULL OR m.deleted_at > ?)
      `).bind(date, parseInt(timestamp)).all();
      return json(results);
    }

    if (path === '/inventory' && method === 'PUT') {
      const record = await request.json() as any;
      await env.DB.prepare(`
        UPDATE inventory SET 
        today_inbound = ?, workshop_outbound = ?, store_outbound = ?, remaining_stock = ?
        WHERE material_id = ? AND date = ?
      `).bind(record.todayInbound, record.workshopOutbound, record.storeOutbound, record.remainingStock, record.materialId, record.date).run();

      const nextRecords = await env.DB.prepare("SELECT id, today_inbound, workshop_outbound, store_outbound FROM inventory WHERE material_id = ? AND date > ? ORDER BY date ASC")
        .bind(record.materialId, record.date).all();
      
      let currentOpening = record.remainingStock;
      for (const next of nextRecords.results as any[]) {
        const nextRemaining = currentOpening + next.today_inbound - next.workshop_outbound - next.store_outbound;
        await env.DB.prepare("UPDATE inventory SET opening_stock = ?, remaining_stock = ? WHERE id = ?")
          .bind(currentOpening, nextRemaining, next.id).run();
        currentOpening = nextRemaining;
      }
      return json({ success: true });
    }

    if (path === '/inventory/initialize' && method === 'POST') {
      const { date, timestamp } = await request.json() as any;
      const mats = await env.DB.prepare(`
        SELECT id FROM materials 
        WHERE created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at > ?)
      `).bind(timestamp, timestamp).all();
      
      for (const m of (mats.results as any[])) {
        const exists = await env.DB.prepare("SELECT id FROM inventory WHERE material_id = ? AND date = ?").bind(m.id, date).first();
        if (!exists) {
          const lastRecord = await env.DB.prepare("SELECT remaining_stock FROM inventory WHERE material_id = ? AND date < ? ORDER BY date DESC LIMIT 1")
            .bind(m.id, date).first() as any;
          const opening = lastRecord ? lastRecord.remaining_stock : 0;
          await env.DB.prepare("INSERT INTO inventory (id, material_id, date, opening_stock, today_inbound, workshop_outbound, store_outbound, remaining_stock) VALUES (?, ?, ?, ?, 0, 0, 0, ?)")
            .bind(crypto.randomUUID(), m.id, date, opening, opening).run();
        }
      }
      return json({ success: true });
    }

    if (path === '/settings' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM settings").all();
      return json(results.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {}));
    }

    if (path === '/settings' && method === 'PUT') {
      const settings = await request.json() as any;
      for (const [key, value] of Object.entries(settings)) {
        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
          .bind(key, String(value)).run();
      }
      return json({ success: true });
    }

    if (path === '/stats' && method === 'GET') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      const endTimestamp = parseInt(url.searchParams.get('endTimestamp') || '0');
      
      const { results } = await env.DB.prepare(`
        SELECT m.name, m.unit, 
        SUM(i.today_inbound) as totalIn, 
        SUM(i.workshop_outbound) as totalWorkshop, 
        SUM(i.store_outbound) as totalStore,
        (SELECT remaining_stock FROM inventory WHERE material_id = m.id AND date <= ? ORDER BY date DESC LIMIT 1) as currentStock
        FROM materials m
        JOIN inventory i ON m.id = i.material_id
        WHERE i.date >= ? AND i.date <= ?
        AND m.created_at <= ?
        AND (m.deleted_at IS NULL OR m.deleted_at > ?)
        GROUP BY m.id
      `).bind(end, start, end, endTimestamp, endTimestamp).all();
      return json(results);
    }

    if (path === '/users' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT id, username, role FROM users").all();
      return json(results);
    }

    if (path === '/logs' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT id, user_id AS userId, username, action, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
      return json(results);
    }

    if (path === '/logs' && method === 'POST') {
      const log = await request.json() as any;
      await env.DB.prepare("INSERT INTO audit_logs (id, user_id, username, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), log.userId, log.username, log.action, log.details, log.timestamp).run();
      return json({ success: true });
    }

    return json({ error: 'Not Found' }, 404);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
