
import { Material, DailyInventory, AuditLog, User } from '../types';
import { withPerformanceMonitoring } from './monitoring';
import { getKVService } from './kv';

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

// 混合缓存系统：内存缓存 + KV 缓存
class HybridDataCache {
  private memoryCache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30分钟缓存
  private readonly STATIC_DATA_TTL = 2 * 60 * 60 * 1000; // 静态数据2小时缓存
  private kvService: any = null;

  private kvInitialized = false;

  constructor() {
    // 延迟初始化 KV 服务（异步）
    this.initKV().catch(error => {
      console.warn('KV 初始化失败:', error);
    });
  }

  private async initKV(): Promise<void> {
    if (this.kvInitialized) return;
    
    try {
      // 在 Pages Functions 中，KV 绑定通过上下文传递
      // 这里需要从环境中获取或者等待传入
      if (typeof window !== 'undefined') {
        // 浏览器环境，不使用 KV
        this.kvInitialized = true;
        return;
      }
      this.kvService = getKVService();
      this.kvInitialized = true;
    } catch (error) {
      this.kvInitialized = true;
      console.warn('KV 服务不可用，仅使用内存缓存:', error);
    }
  }

  private async getKVService(): Promise<any> {
    if (!this.kvInitialized) {
      await this.initKV();
    }
    
    if (!this.kvService) {
      try {
        this.kvService = getKVService();
      } catch (error) {
        // 在浏览器环境或 KV 不可用时，使用 null（仅内存缓存）
        console.warn('KV 服务不可用，使用内存缓存');
        return null;
      }
    }
    return this.kvService;
  }

  async set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    // 设置内存缓存
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    });

    // 同时设置 KV 缓存（异步执行）
    try {
      const kv = await this.getKVService();
      if (kv) {
        await kv.set(key, data, Math.floor(ttl / 1000)); // KV 使用秒作为 TTL
      }
    } catch (error) {
      console.warn('KV 缓存设置失败:', error);
    }
  }

  async setStatic<T>(key: string, data: T): Promise<void> {
    await this.set(key, data, this.STATIC_DATA_TTL);
  }

  async get<T>(key: string): Promise<T | null> {
    // 首先检查内存缓存
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem) {
      if (Date.now() <= memoryItem.expiry) {
        return memoryItem.data;
      }
      // 内存缓存过期，删除
      this.memoryCache.delete(key);
    }

    // 内存缓存未命中，检查 KV 缓存
    try {
      const kv = await this.getKVService();
      if (kv) {
        const kvData = await kv.get<string>(key);
        if (kvData !== null) {
          // 解析 JSON 数据
          const parsedData = JSON.parse(kvData) as T;
          
          // 将 KV 数据同步到内存缓存
          this.memoryCache.set(key, {
            data: parsedData,
            timestamp: Date.now(),
            expiry: Date.now() + this.DEFAULT_TTL
          });
          return parsedData;
        }
      }
    } catch (error) {
      console.warn('KV 缓存读取失败:', error);
    }

    return null;
  }

  async clear(): Promise<void> {
    // 清除内存缓存
    this.memoryCache.clear();

    // 清除 KV 缓存
    try {
      const kv = await this.getKVService();
      if (kv) {
        await kv.clear();
      }
    } catch (error) {
      console.warn('KV 缓存清除失败:', error);
    }
  }

  async delete(key: string): Promise<void> {
    // 删除内存缓存
    this.memoryCache.delete(key);

    // 删除 KV 缓存
    try {
      const kv = await this.getKVService();
      if (kv) {
        await kv.delete(key);
      }
    } catch (error) {
      console.warn('KV 缓存删除失败:', error);
    }
  }

  // 清理过期的内存缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }

  // 获取缓存统计信息
  getStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      memoryCacheItems: Array.from(this.memoryCache.keys())
    };
  }
}

const dataCache = new HybridDataCache();

let cleanupInterval: NodeJS.Timeout | null = null;

// 定期清理过期缓存
if (typeof window === 'undefined') {
  // 只在服务器端设置定时器
  cleanupInterval = setInterval(() => dataCache.cleanup(), 60000); // 每分钟清理一次
}

// 导出清理函数供应用卸载时使用
export const cleanupDataCache = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

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
  clearCache: async (): Promise<void> => {
    await dataCache.clear();
    // 通知服务器清除KV缓存
    fetch(`${API_BASE}/cache/clear`, { method: 'POST' }).catch(() => {});
  },

  clearCacheForDate: async (date: string): Promise<void> => {
    await dataCache.delete(`materials_${date}`);
    await dataCache.delete('materials_current');
    await dataCache.delete(`inventory_${date}`);
    
    // 清除分页缓存（使用模糊匹配）
    const keysToDelete: string[] = [];
    for (const key of dataCache.getStats().memoryCacheItems) {
      if (key.includes('materials_paginated_') || key.includes('inventory_paginated_')) {
        keysToDelete.push(key);
      }
    }
    await Promise.all(keysToDelete.map(key => dataCache.delete(key)));
    
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
      const cached = await dataCache.get<Material[]>(cacheKey);
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
    await dataCache.set(cacheKey, data, CACHE_CONFIG.STATIC_DATA_TTL);
    
    return withPerformanceMonitoring(endpoint, () => Promise.resolve(data), false);
  },

  // 分页获取物料
  getMaterialsPaginated: async (page: number = 1, pageSize: number = 20, date?: string, searchTerm?: string, forceRefresh: boolean = false): Promise<{materials: Material[], total: number, hasMore: boolean}> => {
    const cacheKey = `materials_paginated_${page}_${pageSize}_${date || 'current'}_${searchTerm || ''}`;
    
    // 尝试从缓存获取数据
    if (!forceRefresh) {
      const cached = await dataCache.get<{materials: Material[], total: number, hasMore: boolean}>(cacheKey);
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
    await dataCache.set(cacheKey, data, CACHE_CONFIG.PAGINATION_TTL);
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
    await dataCache.delete(`materials_${date}`);
    await dataCache.delete('materials_current');
    await dataCache.delete(`inventory_${date}`);
    
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
    await dataCache.delete(`materials_${date}`);
    await dataCache.delete('materials_current');
    await dataCache.delete(`inventory_${date}`);
  },

  deleteMaterial: async (id: string, date: string): Promise<void> => {
    return db.deleteMaterials([id], date);
  },

  // --- Inventory ---
  getInventoryForDate: async (date: string, forceRefresh: boolean = false): Promise<DailyInventory[]> => {
    const cacheKey = `inventory_${date}`;
    
    // 尝试从缓存获取数据
    if (!forceRefresh) {
      const cached = await dataCache.get<DailyInventory[]>(cacheKey);
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
    await dataCache.set(cacheKey, data, CACHE_CONFIG.QUERY_DATA_TTL);
    return data;
  },

  // 分页获取库存数据
  getInventoryForDatePaginated: async (date: string, page: number = 1, pageSize: number = 20, searchTerm?: string, forceRefresh: boolean = false): Promise<{inventory: DailyInventory[], total: number, hasMore: boolean}> => {
    const cacheKey = `inventory_paginated_${date}_${page}_${pageSize}_${searchTerm || ''}`;
    
    // 尝试从缓存获取数据
    if (!forceRefresh) {
      const cached = await dataCache.get<{inventory: DailyInventory[], total: number, hasMore: boolean}>(cacheKey);
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
    await dataCache.set(cacheKey, data, CACHE_CONFIG.PAGINATION_TTL);
    return data;
  },

  saveInventoryRecord: async (record: DailyInventory): Promise<void> => {
    await fetch(`${API_BASE}/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    
    // 清除相关缓存
    await dataCache.delete(`inventory_${record.date}`);
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
