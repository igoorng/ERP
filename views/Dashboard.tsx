
import React, { useMemo } from 'react';
import { db } from '../services/db';
import { Package, TrendingUp, TrendingDown, ShoppingBag, AlertTriangle } from 'lucide-react';
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
  const todayStr = new Date().toISOString().split('T')[0];
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
  }, [materials, inventory]);

  const chartData = useMemo(() => {
    return inventory.slice(0, 8).map(item => {
      const mat = materials.find(m => m.id === item.materialId);
      return {
        name: mat?.name.slice(0, 6) || '??',
        remaining: item.remainingStock,
      };
    });
  }, [materials, inventory]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Stat Cards - Better Grid for Mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="总品种" value={stats.totalMaterials} icon={<Package size={20}/>} color="blue" />
        <StatCard label="今入库" value={stats.totalIn} icon={<TrendingUp size={20}/>} color="green" />
        <StatCard label="车间出" value={stats.totalWorkshopOut} icon={<TrendingDown size={20}/>} color="orange" />
        <StatCard label="店面出" value={stats.totalStoreOut} icon={<ShoppingBag size={20}/>} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Card */}
        <div className="lg:col-span-2 bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-gray-900 tracking-tight">前8项库存趋势</h3>
            <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-full">REALTIME</span>
          </div>
          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="remaining" radius={[6, 6, 0, 0]} barSize={30}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.remaining < 10 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-black text-gray-900 mb-6 flex items-center">
            <AlertTriangle size={18} className="mr-2 text-red-500" />
            缺料预警
          </h3>
          <div className="space-y-3">
            {inventory.filter(i => i.remainingStock < 10).length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Package size={24} />
                </div>
                <p className="text-sm text-gray-400 font-medium">当前无缺料项目</p>
              </div>
            ) : (
              inventory.filter(i => i.remainingStock < 10).map(item => {
                const mat = materials.find(m => m.id === item.materialId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-red-50/50 rounded-2xl border border-red-100">
                    <div>
                      <p className="font-bold text-red-900 leading-none mb-1">{mat?.name}</p>
                      <p className="text-[10px] font-bold text-red-600 uppercase">剩 {item.remainingStock} {mat?.unit}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600'
  };
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
      <div className={`p-2.5 rounded-xl mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">{label}</p>
      <h4 className="text-lg font-black text-gray-900">{value}</h4>
    </div>
  );
};

const ChevronRight = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default Dashboard;
