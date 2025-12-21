
import { Material, DailyInventory, AuditLog, User } from '../types';

// API 基础路径，假设 Worker 部署在同一域名或配置了 CORS
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
    // 后端 Worker 启动时应自动检查并创建默认 admin
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
    // 注意：级联更新 (Cascade Update) 逻辑应移至后端 Worker 处理以保证事务一致性
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
