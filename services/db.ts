
import { Material, DailyInventory, AuditLog, User } from '../types';
import { withPerformanceMonitoring } from './monitoring';

const API_BASE = '/api';

const DEFAULT_SETTINGS = {
  LOW_STOCK_THRESHOLD: '10',
  SYSTEM_NAME: 'MaterialFlow Pro'
};

// 缓存配置
const CACHE_CONFIG = {
  STATIC_DATA_TTL: 2 * 60 * 60 * 1000, // 2小时
  QUERY_DATA_TTL: 30 * 60 * 1000,     // 30分钟
  PAGINATION_TTL: 15 * 60 * 1000     // 15分钟
};

// 缓存系统
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class DataCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30分钟缓存（延长缓存时间）
  private readonly STATIC_DATA_TTL = 2 * 60 * 60 * 1000; // 静态数据2小时缓存

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    });
  }

  // 为静态数据设置更长的缓存时间
  setStatic<T>(key: string, data: T): void {
    this.set(key, data, this.STATIC_DATA_TTL);
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

const dataCache = new DataCache();

// 定期清理过期缓存
setInterval(() => dataCache.cleanup(), 60000); // 每分钟清理一次

// 缓存预热功能
export const preloadCommonData = async (): Promise<void> => {
  try {
    const today = db.getBeijingDate();
    
    // 预加载今天的物料数据（静态数据，2小时缓存）
    await db.getMaterials(today, false);
    
    // 预加载前几页的分页数据
    await Promise.all([
      db.getMaterialsPaginated(1, 20, today, '', false),
      db.getInventoryForDatePaginated(today, 1, 20, '', false)
    ]);
    
    console.log('缓存预热完成');
  } catch (error) {
    console.log('缓存预热失败:', error);
  }
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

  // 缓存管理
  clearCache: (): void => {
    dataCache.clear();
    // 通知服务器清除KV缓存
    fetch(`${API_BASE}/cache/clear`, { method: 'POST' }).catch(() => {});
  },

  clearCacheForDate: (date: string): void => {
    dataCache.delete(`materials_${date}`);
    dataCache.delete('materials_current');
    dataCache.delete(`inventory_${date}`);
    
    // 清除分页缓存（使用模糊匹配）
    const keysToDelete: string[] = [];
    for (const key of dataCache['cache'].keys()) {
      if (key.includes('materials_paginated_') || key.includes('inventory_paginated_')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => dataCache.delete(key));
    
    // 通知服务器清除相关KV缓存
    fetch(`${API_BASE}/cache/clear`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patterns: ['materials:', 'inventory:'], date })
    }).catch(() => {});
  },

  // --- Materials ---
  getMaterials: async (date?: string, forceRefresh: boolean = false): Promise<Material[]> => {
    const cacheKey = `materials_${date || 'current'}`;
    
    // 尝试从缓存获取数据
    if (!forceRefresh) {
      const cached = dataCache.get<Material[]>(cacheKey);
      if (cached) return cached;
    }
    
    // 从服务器获取数据
    let url = `${API_BASE}/materials`;
    if (date) {
      const ts = db.getBeijingDayEndTimestamp(date);
      url += `?timestamp=${ts}`;
    }
    
    const endpoint = `GET /materials${date ? `?date=${date}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'X-Cache-Bypass': forceRefresh ? 'true' : 'false',
        'X-Request-ID': crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
      }
    });
    const data = await response.json();
    
    // 缓存数据（使用更长的TTL，因为后端有KV缓存）
    dataCache.set(cacheKey, data, CACHE_CONFIG.STATIC_DATA_TTL);
    
    return withPerformanceMonitoring(endpoint, () => Promise.resolve(data), false);
  },

  // 分页获取物料
  getMaterialsPaginated: async (page: number = 1, pageSize: number = 20, date?: string, searchTerm?: string, forceRefresh: boolean = false): Promise<{materials: Material[], total: number, hasMore: boolean}> => {
    const cacheKey = `materials_paginated_${page}_${pageSize}_${date || 'current'}_${searchTerm || ''}`;
    
    // 尝试从缓存获取数据
    if (!forceRefresh) {
      const cached = dataCache.get<{materials: Material[], total: number, hasMore: boolean}>(cacheKey);
      if (cached) return cached;
    }
    
    // 构建查询参数
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString()
    });
    
    if (date) {
      params.append('date', date);
      const ts = db.getBeijingDayEndTimestamp(date);
      params.append('timestamp', ts.toString());
    }
    
    if (searchTerm) {
      params.append('search', searchTerm);
    }
    
    // 从服务器获取数据
    const url = `${API_BASE}/materials/paginated?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'X-Cache-Bypass': forceRefresh ? 'true' : 'false',
        'X-Request-ID': crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
      }
    });
    const data = await response.json();
    
    // 缓存数据（使用分页TTL）
    dataCache.set(cacheKey, data, CACHE_CONFIG.PAGINATION_TTL);
    return data;
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
    
    // 清除相关缓存
    dataCache.delete(`materials_${date}`);
    dataCache.delete('materials_current');
    dataCache.delete(`inventory_${date}`);
    
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
    
    // 清除相关缓存
    dataCache.delete(`materials_${date}`);
    dataCache.delete('materials_current');
    dataCache.delete(`inventory_${date}`);
  },

  deleteMaterial: async (id: string, date: string): Promise<void> => {
    return db.deleteMaterials([id], date);
  },

  // --- Inventory ---
  getInventoryForDate: async (date: string, forceRefresh: boolean = false): Promise<DailyInventory[]> => {
    const cacheKey = `inventory_${date}`;
    
    // 尝试从缓存获取数据
    if (!forceRefresh) {
      const cached = dataCache.get<DailyInventory[]>(cacheKey);
      if (cached) return cached;
    }
    
    // 从服务器获取数据
    const response = await fetch(`${API_BASE}/inventory?date=${date}&timestamp=${Date.now()}`, {
      headers: {
        'X-Cache-Bypass': forceRefresh ? 'true' : 'false',
        'X-Request-ID': crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
      }
    });
    const data = await response.json();
    
    // 缓存数据（使用查询TTL）
    dataCache.set(cacheKey, data, CACHE_CONFIG.QUERY_DATA_TTL);
    return data;
  },

  // 分页获取库存数据
  getInventoryForDatePaginated: async (date: string, page: number = 1, pageSize: number = 20, searchTerm?: string, forceRefresh: boolean = false): Promise<{inventory: DailyInventory[], total: number, hasMore: boolean}> => {
    const cacheKey = `inventory_paginated_${date}_${page}_${pageSize}_${searchTerm || ''}`;
    
    // 尝试从缓存获取数据
    if (!forceRefresh) {
      const cached = dataCache.get<{inventory: DailyInventory[], total: number, hasMore: boolean}>(cacheKey);
      if (cached) return cached;
    }
    
    // 构建查询参数
    const params = new URLSearchParams({
      date,
      page: page.toString(),
      pageSize: pageSize.toString()
    });
    
    if (searchTerm) {
      params.append('search', searchTerm);
    }
    
    // 从服务器获取数据
    const url = `${API_BASE}/inventory/paginated?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'X-Cache-Bypass': forceRefresh ? 'true' : 'false',
        'X-Request-ID': crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
      }
    });
    const data = await response.json();
    
    // 缓存数据（使用分页TTL）
    dataCache.set(cacheKey, data, CACHE_CONFIG.PAGINATION_TTL);
    return data;
  },

  saveInventoryRecord: async (record: DailyInventory): Promise<void> => {
    await fetch(`${API_BASE}/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    
    // 清除相关缓存
    dataCache.delete(`inventory_${record.date}`);
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
