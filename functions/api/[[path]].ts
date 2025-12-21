
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
    // 1. 验证
    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = await request.json() as any;
      const user = await env.DB.prepare("SELECT id, username, role FROM users WHERE username = ? AND password_hash = ?")
        .bind(username, password).first();
      return user ? json(user) : json({ error: 'Unauthorized' }, 401);
    }

    if (path === '/auth/init' && method === 'POST') {
      await env.DB.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)")
        .bind('admin-id', 'admin', 'admin', 'admin').run();
      return json({ message: 'Init success' });
    }

    // 2. 物料 (Materials)
    if (path === '/materials' && method === 'GET') {
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
      const { results } = await env.DB.prepare(`
        SELECT * FROM materials 
        WHERE created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at > ?)
      `).bind(date, date).all();
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

    // 3. 库存 (Inventory) - 已修复 bind 顺序并移除冗余块
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
      const mats = await env.DB.prepare(`
        SELECT id FROM materials 
        WHERE created_at <= ? 
        AND (deleted_at IS NULL OR deleted_at > ?)
      `).bind(date, date).all();
      
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

    if (path === '/users' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT id, username, role FROM users").all();
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
