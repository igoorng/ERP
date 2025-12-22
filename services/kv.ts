// KV 命名空间类型定义
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

interface KVService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

export class CloudflareKVService implements KVService {
  private kv: KVNamespace;

  constructor(kvBinding: KVNamespace) {
    this.kv = kvBinding;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const options = ttl ? { expirationTtl: ttl } : undefined;
      await this.kv.put(key, serialized, options);
    } catch (error) {
      console.error('KV set error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error('KV delete error:', error);
      throw error;
    }
  }

  async list(prefix?: string): Promise<string[]> {
    try {
      const list = await this.kv.list({ prefix });
      return list.keys.map(key => key.name);
    } catch (error) {
      console.error('KV list error:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.list();
      await Promise.all(keys.map(key => this.delete(key)));
    } catch (error) {
      console.error('KV clear error:', error);
      throw error;
    }
  }

  // 缓存相关的便捷方法
  async cache<T>(key: string, fetcher: () => Promise<T>, ttl: number = 3600): Promise<T> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，获取数据并缓存
    const data = await fetcher();
    await this.set(key, data, ttl);
    return data;
  }
}

// 导出单例实例
let kvService: CloudflareKVService | null = null;

export function getKVService(): CloudflareKVService {
  if (!kvService) {
    // 在 Cloudflare Pages Functions 环境中，KV 绑定需要从上下文获取
    // 这里先尝试全局变量，如果没有则在调用时从 context 传入
    const kvBinding = (globalThis as any).KV;
    if (!kvBinding) {
      // 如果在 Pages Functions 上下文中调用，需要传入 KV 绑定
      throw new Error('KV binding not found. In Pages Functions, pass KV binding to getKVService(KV).');
    }
    kvService = new CloudflareKVService(kvBinding);
  }
  return kvService;
}

// 为 Pages Functions 提供的辅助函数
export function getKVServiceWithBinding(kvBinding: KVNamespace): CloudflareKVService {
  if (!kvService || kvService !== new CloudflareKVService(kvBinding)) {
    kvService = new CloudflareKVService(kvBinding);
  }
  return kvService;
}

// 类型定义
declare global {
  var KV: KVNamespace;
}
