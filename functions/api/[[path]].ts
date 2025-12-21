
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

  // 安全检查：确保 DB 绑定存在
  if (!env.DB) {
    return json({ 
      error: 'D1 Database binding missing. 请检查 Cloudflare 控制台中的 D1 绑定设置 (Variable Name 必须为 DB)。',
      code: 'DATABASE_BINDING_MISSING'
    }, 500);
  }

  try {
    // 1. 身份验证 & 初始化
    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = await request.json() as any;
      const user = await env.DB.prepare("SELECT id, username, role FROM users WHERE username = ? AND password_hash = ?")
        .bind(username, password).first();
      return user ? json(user) : json({ error: 'Unauthorized' }, 401);
    }

    if (path === '/auth/init' && method === 'POST') {
      const userExists = await env.DB.prepare("SELECT id FROM users LIMIT 1").first();
      if (!userExists) {
        await env.DB.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)")
          .bind('admin-id', 'admin', 'admin', 'admin').run();
      }
      const settingsTableExists = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").first();
      if (settingsTableExists) {
        const settingsCount = await env.DB.prepare("SELECT COUNT(*) as count FROM settings").first();
        if (settingsCount.count === 0) {
          await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?), (?, ?)")
            .bind('LOW_STOCK_THRESHOLD', '10', 'SYSTEM_NAME', 'MaterialFlow Pro').run();
        }
      }
      return json({ message: 'Success' });
    }

    // 2. 用户管理 (Users Management)
    if (path === '/users' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT id, username, role FROM users").all();
      return json(results);
    }

    if (path === '/users' && method === 'POST') {
      const { username, password, role } = await request.json() as any;
      const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
      if (exists) return json({ error: 'Username already exists' }, 400);
      
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)")
        .bind(id, username, password, role || 'user').run();
      return json({ id, username, role });
    }

    if (path === '/users/password' && method === 'PUT') {
      const { userId, newPassword } = await request.json() as any;
      await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(newPassword, userId).run();
      return json({ success: true });
    }

    if (path === '/users' && method === 'DELETE') {
      const id = url.searchParams.get('id');
      // 防止删除最后一个管理员
      const adminCount = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").first();
      const target = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(id).first();
      if (target?.role === 'admin' && adminCount.count <= 1) {
        return json({ error: 'Cannot delete the last admin' }, 400);
      }
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return json({ success: true });
    }

    // 3. 系统设置 (Settings)
    if (path === '/settings' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM settings").all();
      const settingsMap = results.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      return json(settingsMap);
    }

    if (path === '/settings' && method === 'PUT') {
      const settings = await request.json() as any;
      for (const [key, value] of Object.entries(settings)) {
        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
          .bind(key, String(value)).run();
      }
      return json({ success: true });
    }

    // 4. 物料管理 (Materials)
    if (path === '/materials' && method === 'GET') {
      const date = url.searchParams.get('date');
      let query = "SELECT * FROM materials";
      let bindings: any[] = [];
      if (date) {
        query += " WHERE (created_at <= ? OR created_at IS NULL) AND (deleted_at > ? OR deleted_at IS NULL)";
        bindings = [date, date];
      }
      const { results } = await env.DB.prepare(query).bind(...bindings).all();
      return json(results);
    }

    if (path === '/materials' && method === 'POST') {
      const { name, unit, initialStock, date } = await request.json() as any;
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO materials (id, name, unit, created_at) VALUES (?, ?, ?, ?)")
        .bind(id, name, unit, date).run();
      await env.DB.prepare("INSERT INTO inventory (id, material_id, date, opening_stock, today_inbound, workshop_outbound, store_outbound, remaining_stock) VALUES (?, ?, ?, ?, 0, 0, 0, ?)")
        .bind(crypto.randomUUID(), id, date, initialStock, initialStock).run();
      return json({ id, name, unit });
    }

    if (path === '/materials/batch-delete' && method === 'POST') {
      const { ids, date } = await request.json() as any;
      for (const id of ids) {
        await env.DB.prepare("UPDATE materials SET deleted_at = ? WHERE id = ?").bind(date, id).run();
      }
      return json({ success: true });
    }

    // 5. 库存管理 (Inventory)
    if (path === '/inventory' && method === 'GET') {
      const date = url.searchParams.get('date');
      const { results } = await env.DB.prepare("SELECT * FROM inventory WHERE date = ?").bind(date).all();
      return json(results);
    }

    if (path === '/inventory' && method === 'PUT') {
      const record = await request.json() as any;
      await env.DB.prepare(`
        UPDATE inventory SET 
        today_inbound = ?, workshop_outbound = ?, store_outbound = ?, remaining_stock = ?
        WHERE material_id = ? AND date = ?
      `).bind(record.todayInbound, record.workshopOutbound, record.storeOutbound, record.remainingStock, record.materialId, record.date).run();

      const nextRecords = await env.DB.prepare("SELECT * FROM inventory WHERE material_id = ? AND date > ? ORDER BY date ASC")
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
      const { date } = await request.json() as any;
      const mats = await env.DB.prepare("SELECT id FROM materials WHERE (deleted_at > ? OR deleted_at IS NULL)").bind(date).all();
      for (const m of mats.results as any[]) {
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

    // 6. 统计与日志
    if (path === '/stats' && method === 'GET') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      const { results } = await env.DB.prepare(`
        SELECT m.name, m.unit, 
        SUM(i.today_inbound) as totalIn, 
        SUM(i.workshop_outbound) as totalWorkshop, 
        SUM(i.store_outbound) as totalStore,
        (SELECT remaining_stock FROM inventory WHERE material_id = m.id AND date <= ? ORDER BY date DESC LIMIT 1) as currentStock
        FROM materials m
        JOIN inventory i ON m.id = i.material_id
        WHERE i.date >= ? AND i.date <= ?
        GROUP BY m.id
      `).bind(end, start, end).all();
      return json(results);
    }

    if (path === '/logs' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
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
