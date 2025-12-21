// 性能监控和调试工具
interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  apiCalls: number;
  averageResponseTime: number;
  slowQueries: Array<{ endpoint: string; duration: number; timestamp: number }>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    averageResponseTime: 0,
    slowQueries: []
  };

  private responseTimes: number[] = [];

  // 记录缓存命中
  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  // 记录缓存未命中
  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  // 记录API调用
  recordApiCall(endpoint: string, duration: number): void {
    this.metrics.apiCalls++;
    this.responseTimes.push(duration);
    
    // 只保留最近100次的响应时间
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    // 计算平均响应时间
    this.metrics.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    // 记录慢查询（超过500ms）
    if (duration > 500) {
      this.metrics.slowQueries.push({
        endpoint,
        duration,
        timestamp: Date.now()
      });
      
      // 只保留最近20个慢查询
      if (this.metrics.slowQueries.length > 20) {
        this.metrics.slowQueries.shift();
      }
    }
  }

  // 获取缓存命中率
  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }

  // 获取性能指标
  getMetrics(): PerformanceMetrics & { cacheHitRate: number } {
    return {
      ...this.metrics,
      cacheHitRate: this.getCacheHitRate()
    };
  }

  // 重置指标
  reset(): void {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      averageResponseTime: 0,
      slowQueries: []
    };
    this.responseTimes = [];
  }

  // 生成性能报告
  generateReport(): string {
    const { cacheHitRate, averageResponseTime, slowQueries } = this.getMetrics();
    
    return `
📊 Performance Report
==================
Cache Hit Rate: ${cacheHitRate.toFixed(2)}%
Average Response Time: ${averageResponseTime.toFixed(2)}ms
API Calls: ${this.metrics.apiCalls}
Slow Queries: ${slowQueries.length}

Recent Slow Queries:
${slowQueries.slice(-5).map(q => `- ${q.endpoint}: ${q.duration}ms`).join('\n')}
    `.trim();
  }
}

// 创建全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

// API调用包装器
export const withPerformanceMonitoring = async <T>(
  endpoint: string,
  apiCall: () => Promise<T>,
  cacheHit: boolean = false
): Promise<T> => {
  const startTime = performance.now();
  
  // 记录缓存统计
  if (cacheHit) {
    performanceMonitor.recordCacheHit();
  } else {
    performanceMonitor.recordCacheMiss();
  }
  
  try {
    const result = await apiCall();
    const duration = performance.now() - startTime;
    
    // 记录API性能
    performanceMonitor.recordApiCall(endpoint, duration);
    
    // 在开发环境输出性能日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 ${endpoint}: ${duration.toFixed(2)}ms ${cacheHit ? '(cached)' : '(api)'}`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`❌ ${endpoint}: ${duration.toFixed(2)}ms (error)`, error);
    throw error;
  }
};

// 缓存性能装饰器
export const cached = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  getCacheKey: (...args: T) => string
) => {
  const cache = new Map<string, { data: R; timestamp: number; ttl: number }>();
  
  return async (...args: T): Promise<R> => {
    const cacheKey = getCacheKey(...args);
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return withPerformanceMonitoring(cacheKey, () => Promise.resolve(cached.data), true);
    }
    
    const result = await withPerformanceMonitoring(cacheKey, () => fn(...args), false);
    
    // 默认缓存5分钟
    cache.set(cacheKey, { data: result, timestamp: now, ttl: 5 * 60 * 1000 });
    
    return result;
  };
};