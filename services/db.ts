
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

  // --- Remote Cache Control ---
  clearRemoteCache: async (): Promise<void> => {
    await fetch(`${API_BASE}/cache/clear`, { method: 'POST' });
  },

  // --- Settings ---
  getSettings: async (forceRefresh = false): Promise<Record<string, string>> => {
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        headers: forceRefresh ? { 'X-Cache-Bypass': 'true' } : {}
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      return { ...DEFAULT_SETTINGS, ...data };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings: async (settings: Record<string, string>): Promise<void> => {
    await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    await db.logAction('UPDATE', `更新系统配置: ${Object.keys(settings).join(', ')}`);
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
    const result = await response.json();
    await db.logAction('CREATE', `新增用户: ${user.username}`);
    return result;
  },

  deleteUser: async (userId: string): Promise<void> => {
    await fetch(`${API_BASE}/users?id=${userId}`, { method: 'DELETE' });
    await db.logAction('DELETE', `注销账号: ${userId}`);
  },

  // --- Materials ---
  getMaterials: async (date?: string, forceRefresh = false): Promise<Material[]> => {
    let url = `${API_BASE}/materials`;
    if (date) {
      const ts = new Date(`${date}T23:59:59.999+08:00`).getTime();
      url += `?timestamp=${ts}`;
    }
    const response = await fetch(url, {
      headers: forceRefresh ? { 'X-Cache-Bypass': 'true' } : {}
    });
    return response.json();
  },

  getMaterialsPaginated: async (page = 1, pageSize = 20, date?: string, searchTerm?: string, forceRefresh = false): Promise<{materials: Material[], total: number, hasMore: boolean}> => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (date) params.append('date', date);
    if (searchTerm) params.append('search', searchTerm);
    
    const response = await fetch(`${API_BASE}/materials/paginated?${params.toString()}`, {
      headers: forceRefresh ? { 'X-Cache-Bypass': 'true' } : {}
    });
    return response.json();
  },

  addMaterial: async (name: string, unit: string, initialStock: number, date: string): Promise<Material> => {
    const ts = new Date(`${date}T00:00:00.000+08:00`).getTime();
    const response = await fetch(`${API_BASE}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, unit, initialStock, date, timestamp: ts })
    });
    const result = await response.json();
    await db.logAction('CREATE', `新增物料: ${name}`);
    return result;
  },

  deleteMaterials: async (ids: string[], date: string): Promise<void> => {
    const ts = Date.now();
    await fetch(`${API_BASE}/materials/batch-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, timestamp: ts })
    });
    await db.logAction('DELETE', `批量删除: ${ids.length} 项`);
  },

  deleteMaterial: async (id: string, date: string): Promise<void> => {
    return db.deleteMaterials([id], date);
  },

  // --- Inventory ---
  getInventoryForDate: async (date: string, forceRefresh = false): Promise<DailyInventory[]> => {
    const response = await fetch(`${API_BASE}/inventory?date=${date}`, {
      headers: forceRefresh ? { 'X-Cache-Bypass': 'true' } : {}
    });
    return response.json();
  },

  getInventoryForDatePaginated: async (date: string, page = 1, pageSize = 20, searchTerm?: string, forceRefresh = false): Promise<{inventory: DailyInventory[], total: number, hasMore: boolean}> => {
    const params = new URLSearchParams({ date, page: String(page), pageSize: String(pageSize) });
    if (searchTerm) params.append('search', searchTerm);
    
    const response = await fetch(`${API_BASE}/inventory/paginated?${params.toString()}`, {
      headers: forceRefresh ? { 'X-Cache-Bypass': 'true' } : {}
    });
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
    const ts = new Date(`${date}T23:59:59.999+08:00`).getTime();
    await fetch(`${API_BASE}/inventory/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, timestamp: ts })
    });
  },

  getAggregatedStatistics: async (startDate: string, endDate: string, forceRefresh = false): Promise<any[]> => {
    const response = await fetch(`${API_BASE}/stats?start=${startDate}&end=${endDate}`, {
      headers: forceRefresh ? { 'X-Cache-Bypass': 'true' } : {}
    });
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

// Fix: Added preloadCommonData function to warm up cache on app start
export const preloadCommonData = async () => {
  try {
    const today = db.getBeijingDate();
    // Warm up common data stores to prime Cloudflare KV and browser cache
    await Promise.allSettled([
      db.getMaterials(today),
      db.getSettings(),
      db.getInventoryForDate(today)
    ]);
  } catch (e) {
    console.warn('Preload failed:', e);
  }
};
