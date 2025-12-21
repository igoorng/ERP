
import { Material, DailyInventory, AuditLog, User } from '../types';

const API_BASE = '/api';

const DEFAULT_SETTINGS = {
  LOW_STOCK_THRESHOLD: '10',
  SYSTEM_NAME: 'MaterialFlow Pro'
};

export const db = {
  // --- Time Utilities ---
  getBeijingDate: (): string => {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
  },

  // 获取该日期北京时间 00:00:00.000 的 Unix 时间戳（用于创建）
  getBeijingDayStartTimestamp: (dateStr: string): number => {
    return new Date(`${dateStr}T00:00:00.000+08:00`).getTime();
  },

  // 获取该日期北京时间 23:59:59.999 的 Unix 时间戳（用于查询过滤）
  getBeijingDayEndTimestamp: (dateStr: string): number => {
    return new Date(`${dateStr}T23:59:59.999+08:00`).getTime();
  },

  getBeijingTimestamp: (): string => {
    return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  },

  getBeijingTimeOnly: (): string => {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());
  },

  // --- Settings ---
  getSettings: async (): Promise<Record<string, string>> => {
    try {
      const response = await fetch(`${API_BASE}/settings`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      return { ...DEFAULT_SETTINGS, ...data };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings: async (settings: Record<string, string>): Promise<void> => {
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to save settings');
    await db.logAction('UPDATE', `更新了系统配置: ${Object.keys(settings).join(', ')}`);
  },

  // --- Auth & Users ---
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem('mf_pro_session');
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) localStorage.setItem('mf_pro_session', JSON.stringify(user));
    else localStorage.removeItem('mf_pro_session');
  },

  authenticate: async (username: string, password: string): Promise<User | null> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) return null;
    return response.json();
  },

  initAuth: async () => {
    return fetch(`${API_BASE}/auth/init`, { method: 'POST' });
  },

  getUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE}/users`);
    return response.json();
  },

  addUser: async (user: Partial<User> & { password?: string }): Promise<User> => {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add user');
    }
    const result = await response.json();
    await db.logAction('CREATE', `新增用户: ${user.username}`);
    return result;
  },

  updateUserPassword: async (userId: string, newPassword: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/users/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPassword })
    });
    if (!response.ok) throw new Error('Failed to update password');
    await db.logAction('UPDATE', `修改了用户 ID ${userId} 的密码`);
  },

  deleteUser: async (userId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/users?id=${userId}`, { method: 'DELETE' });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete user');
    }
    await db.logAction('DELETE', `删除了用户 ID ${userId}`);
  },

  // --- Materials ---
  getMaterials: async (date?: string): Promise<Material[]> => {
    let url = `${API_BASE}/materials`;
    if (date) {
      const ts = db.getBeijingDayEndTimestamp(date);
      url += `?timestamp=${ts}`;
    }
    const response = await fetch(url);
    return response.json();
  },

  addMaterial: async (name: string, unit: string, initialStock: number, date: string): Promise<Material> => {
    // 关键修复：物料创建时间设为该日期的 00:00:00，确保在该日期可见
    const ts = db.getBeijingDayStartTimestamp(date);
    const response = await fetch(`${API_BASE}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        unit, 
        initialStock, 
        date, 
        timestamp: ts 
      })
    });
    const result = await response.json();
    await db.logAction('CREATE', `新增物料: ${name} (期初: ${initialStock})`);
    return result;
  },

  deleteMaterials: async (ids: string[], date: string): Promise<void> => {
    const ts = Date.now();
    await fetch(`${API_BASE}/materials/batch-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, timestamp: ts })
    });
    await db.logAction('DELETE', `删除物料: ${ids.length}项`);
  },

  deleteMaterial: async (id: string, date: string): Promise<void> => {
    return db.deleteMaterials([id], date);
  },

  // --- Inventory ---
  getInventoryForDate: async (date: string): Promise<DailyInventory[]> => {
    const response = await fetch(`${API_BASE}/inventory?date=${date}&timestamp=${Date.now()}`);
    return response.json();
  },

  saveInventoryRecord: async (record: DailyInventory): Promise<void> => {
    await fetch(`${API_BASE}/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
  },

  initializeDate: async (date: string): Promise<void> => {
    const ts = db.getBeijingDayEndTimestamp(date);
    await fetch(`${API_BASE}/inventory/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, timestamp: ts })
    });
  },

  getAggregatedStatistics: async (startDate: string, endDate: string): Promise<any[]> => {
    const endTs = db.getBeijingDayEndTimestamp(endDate);
    const response = await fetch(`${API_BASE}/stats?start=${startDate}&end=${endDate}&endTimestamp=${endTs}`);
    return response.json();
  },

  // --- Logs ---
  getLogs: async (): Promise<AuditLog[]> => {
    const response = await fetch(`${API_BASE}/logs`);
    return response.json();
  },

  logAction: async (action: string, details: string): Promise<void> => {
    const user = db.getCurrentUser();
    await fetch(`${API_BASE}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.id || 'system',
        username: user?.username || 'System',
        action,
        details,
        timestamp: db.getBeijingTimestamp()
      })
    });
  }
};
