
import { Material, DailyInventory, AuditLog, User } from '../types';

const API_BASE = '/api';

export const db = {
  // --- Time Utilities (强制亚洲/上海时区) ---
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
      return response.json();
    } catch (e) {
      return { LOW_STOCK_THRESHOLD: '10', SYSTEM_NAME: 'MaterialFlow Pro' };
    }
  },

  saveSettings: async (settings: Record<string, string>): Promise<void> => {
    await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    await db.logAction('UPDATE', '更新了系统全局配置');
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
    const url = date ? `${API_BASE}/materials?date=${date}` : `${API_BASE}/materials`;
    const response = await fetch(url);
    return response.json();
  },

  addMaterial: async (name: string, unit: string, initialStock: number, date: string): Promise<Material> => {
    const response = await fetch(`${API_BASE}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, unit, initialStock, date })
    });
    const result = await response.json();
    await db.logAction('CREATE', `新增物料: ${name} (期初: ${initialStock})`);
    return result;
  },

  deleteMaterials: async (ids: string[], date: string): Promise<void> => {
    await fetch(`${API_BASE}/materials/batch-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, date })
    });
    await db.logAction('DELETE', `删除物料: ${ids.length}项`);
  },

  deleteMaterial: async (id: string, date: string): Promise<void> => {
    return db.deleteMaterials([id], date);
  },

  // --- Inventory ---
  getInventoryForDate: async (date: string): Promise<DailyInventory[]> => {
    const response = await fetch(`${API_BASE}/inventory?date=${date}`);
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
    await fetch(`${API_BASE}/inventory/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });
  },

  getAggregatedStatistics: async (startDate: string, endDate: string): Promise<any[]> => {
    const response = await fetch(`${API_BASE}/stats?start=${startDate}&end=${endDate}`);
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
