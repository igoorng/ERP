
import React, { useState, useEffect } from 'react';
import { performanceMonitor } from '../services/monitoring';
import { db } from '../services/db';

const CacheTestView: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateMetrics = () => {
    setMetrics(performanceMonitor.getMetrics());
  };

  useEffect(() => {
    const interval = setInterval(updateMetrics, 1000);
    updateMetrics();
    return () => clearInterval(interval);
  }, []);

  const runPerformanceTest = async () => {
    setIsRunning(true);
    const results: string[] = [];
    
    try {
      results.push('🧪 开始性能测试...');
      
      // 测试物料查询性能
      const startTime = performance.now();
      await db.getMaterials();
      const materialsTime = performance.now() - startTime;
      results.push(`✅ 物料查询: ${materialsTime.toFixed(2)}ms`);
      
      // 测试分页查询性能
      const pageStartTime = performance.now();
      await db.getMaterialsPaginated(1, 20);
      const pageTime = performance.now() - pageStartTime;
      results.push(`✅ 分页查询: ${pageTime.toFixed(2)}ms`);
      
      // 测试库存查询性能
      const today = db.getBeijingDate();
      const inventoryStartTime = performance.now();
      await db.getInventoryForDate(today);
      const inventoryTime = performance.now() - inventoryStartTime;
      results.push(`✅ 库存查询: ${inventoryTime.toFixed(2)}ms`);
      
      // 测试缓存命中（第二次查询相同数据）
      const cachedStartTime = performance.now();
      await db.getMaterials();
      const cachedTime = performance.now() - cachedStartTime;
      results.push(`✅ 缓存命中: ${cachedTime.toFixed(2)}ms`);
      
      // 测试设置查询性能
      const settingsStartTime = performance.now();
      await db.getSettings();
      const settingsTime = performance.now() - settingsStartTime;
      results.push(`✅ 设置查询: ${settingsTime.toFixed(2)}ms`);
      
      results.push('🎉 性能测试完成!');
      
    } catch (error) {
      results.push(`❌ 测试失败: ${error}`);
    } finally {
      setTestResults(results);
      setIsRunning(false);
      updateMetrics();
    }
  };

  const clearCache = async () => {
    try {
      // Fix: Use the correct method name from db service
      await db.clearRemoteCache();
      setTestResults(['🧹 缓存已清除']);
      updateMetrics();
    } catch (error) {
      setTestResults([`❌ 清除缓存失败: ${error}`]);
    }
  };

  const generateReport = () => {
    return performanceMonitor.generateReport();
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold text-gray-900">🚀 KV 缓存性能测试</h2>
      
      {/* 实时指标 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">📊 实时性能指标</h3>
        {metrics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{metrics.cacheHitRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">缓存命中率</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{metrics.averageResponseTime.toFixed(0)}ms</div>
              <div className="text-sm text-gray-600">平均响应时间</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{metrics.apiCalls}</div>
              <div className="text-sm text-gray-600">API调用次数</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{metrics.slowQueries.length}</div>
              <div className="text-sm text-gray-600">慢查询数量</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">加载中...</div>
        )}
      </div>

      {/* 控制按钮 */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={runPerformanceTest}
          disabled={isRunning}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {isRunning ? '⏳ 测试中...' : '🧪 运行性能测试'}
        </button>
        
        <button
          onClick={clearCache}
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          🧹 清除缓存
        </button>
        
        <button
          onClick={() => alert(generateReport())}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          📈 生成报告
        </button>
      </div>

      {/* 测试结果 */}
      {testResults.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">📝 测试结果</h3>
          <div className="space-y-2">
            {testResults.map((result, index) => (
              <div key={index} className="text-sm font-mono bg-gray-50 p-2 rounded">
                {result}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 缓存使用说明 */}
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-semibold mb-4">💡 KV 缓存说明</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p><strong>静态数据缓存 (2小时):</strong> 物料信息、用户信息、系统设置</p>
          <p><strong>查询结果缓存 (30分钟):</strong> 每日库存、统计数据</p>
          <p><strong>分页数据缓存 (15分钟):</strong> 物料和库存的分页查询</p>
          <p><strong>缓存失效策略:</strong> 数据更新时自动清除相关缓存</p>
        </div>
      </div>

      {/* 慢查询列表 */}
      {metrics && metrics.slowQueries.length > 0 && (
        <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
          <h3 className="text-lg font-semibold mb-4">⚠️ 慢查询列表</h3>
          <div className="space-y-2">
            {metrics.slowQueries.map((query: any, index: number) => (
              <div key={index} className="text-sm bg-white p-3 rounded border border-orange-100">
                <div className="font-mono">{query.endpoint}</div>
                <div className="text-orange-600">{query.duration.toFixed(2)}ms</div>
                <div className="text-gray-500 text-xs">
                  {new Date(query.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CacheTestView;
