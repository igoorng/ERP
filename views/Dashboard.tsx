
import React, { useMemo, useEffect, useState } from 'react';
import { db } from '../services/db';
import { config } from '../services/config';
import { Package, TrendingUp, TrendingDown, ShoppingBag, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

const Dashboard: React.FC = () => {
  // 获取当前系统日期
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 组件加载时，确保今日数据已初始化（承接昨日余量并重置增量）
  useEffect(() => {
    db.initializeDate(todayStr);
    setRefreshTrigger(prev => prev + 1);
  }, [todayStr]);

  const materials = db.getMaterials();
  const inventory = db.getInventoryForDate(todayStr);

  const stats = useMemo(() => {
    let totalIn = 0;
    let totalWorkshopOut = 0;
    let totalStoreOut = 0;
    inventory.forEach(item => {
      totalIn += item.todayInbound;
      totalWorkshopOut += item.workshopOutbound;
      totalStoreOut += item.storeOutbound;
    });
    return {
      totalMaterials: materials.length,
      totalIn,
      totalWorkshopOut,
      totalStoreOut,
    };
  }, [materials, inventory, refreshTrigger]);

  const chartData = useMemo(() => {
    return inventory
      .sort((a, b) => b.remainingStock - a.remainingStock)
      .slice(0, 8)
      .map(item => {
        const mat = materials.find(m => m.id === item.materialId);
        return {
          name: mat?.name.slice(0, 6) || '未知',
          remaining: item.remainingStock,
        };
      });
  }, [materials, inventory, refreshTrigger]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* 顶部状态条 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">今日数据概览</h2>
          <p className="text-gray-500 text-sm font-medium">数据基于当日实时变动自动计算</p>
        </div>
        <div className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-2xl shadow-lg shadow-blue-200">
          <CalendarIcon size={18} />
          <span className="font-bold text-sm">{todayStr} (今日)</span>
        </div>
      </div>

      {/* 核心统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <StatCard 
          label="物料品种" 
          value={stats.totalMaterials} 
          subLabel="全库种类"
          icon={<Package size={22}/>} 
          color="blue" 
        />
        <StatCard 
          label="今日入库" 
          value={stats.totalIn} 
          subLabel="今日新增"
          icon={<TrendingUp size={22}/>} 
          color="green" 
        />
        <StatCard 
          label="车间出库" 
          value={stats.totalWorkshopOut} 
          subLabel="生产消耗"
          icon={<TrendingDown size={22}/>} 
          color="orange" 
        />
        <StatCard 
          label="店面出库" 
          value={stats.totalStoreOut} 
          subLabel="销售/外调"
          icon={<ShoppingBag size={22}/>} 
          color="purple" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 核心图表 */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-black text-gray-900 tracking-tight">库存量前8名</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Stock Ranking (Top 8)</p>
            </div>
            <div className="flex items-center space-x-1.5 bg-green-50 px-3 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-green-600">实时同步中</span>
            </div>
          </div>
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                />
                <Bar dataKey="remaining" radius={[8, 8, 0, 0]} barSize={35}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.remaining < config.LOW_STOCK_THRESHOLD ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 缺料预警面板 */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
          <h3 className="font-black text-gray-900 mb-6 flex items-center">
            <AlertTriangle size={20} className="mr-2 text-red-500" />
            今日缺料预警
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {inventory.filter(i => i.remainingStock < config.LOW_STOCK_THRESHOLD).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 opacity-40">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Package size={32} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 font-bold">暂无库存告急物料</p>
              </div>
            ) : (
              inventory
                .filter(i => i.remainingStock < config.LOW_STOCK_THRESHOLD)
                .sort((a, b) => a.remainingStock - b.remainingStock)
                .map(item => {
                  const mat = materials.find(m => m.id === item.materialId);
                  return (
                    <div key={item.id} className="group flex items-center justify-between p-4 bg-red-50/40 rounded-2xl border border-red-100/50 hover:bg-red-50 transition-colors">
                      <div>
                        <p className="font-black text-red-900 leading-none mb-1.5">{mat?.name}</p>
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                          当前剩余: {item.remainingStock} {mat?.unit}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm group-hover:scale-110 transition-transform">
                        <AlertTriangle size={18} />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-50">
             <p className="text-[10px] text-gray-400 font-bold text-center">阈值设定: 低于 {config.LOW_STOCK_THRESHOLD} 即触发告警</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Internal component for statistic cards
const StatCard = ({ label, value, subLabel, icon, color }: any) => {
  const iconBg: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600'
  };
  return (
    <div className="bg-white p-4 lg:p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center space-x-4">
      {/* Fix: Ensure className is always a string to satisfy TypeScript requirements and avoid boolean type errors */}
      <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg[color] || 'bg-gray-50 text-gray-600'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">{label}</p>
        <div className="flex items-baseline space-x-1">
          <h4 className="text-xl lg:text-2xl font-black text-gray-900 leading-none">{value}</h4>
          <span className="text-[10px] font-bold text-gray-400">{subLabel}</span>
        </div>
      </div>
    </div>
  );
};

// Fix: Add missing default export to resolve import error in App.tsx
export default Dashboard;
