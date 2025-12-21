
import { Material, DailyInventory, AuditLog, User } from '../types';

const API_BASE = '/api';

export const db = {
  // --- Time Utilities ---
  getBeijingDate: (): string => {
    const now = new Date();
    const offset = 8 * 60;
    const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() + offset) * 60000);
    return beijingTime.toISOString().split('T')[0];
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

  // --- Settings (Dynamic Config) ---
  getSettings: async (): Promise<Record<string, string>> => {
    try {
      const response = await fetch(`${API_BASE}/settings`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    } catch (e) {
      // 容错：返回默认值
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

  // --- Auth ---
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
    await db.logAction('CREATE', `新增物料: ${name}`);
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
