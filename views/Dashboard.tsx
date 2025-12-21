
import React, { useMemo } from 'react';
import { db } from '../services/db';
import { Package, TrendingUp, TrendingDown, ShoppingBag, ArrowUpRight } from 'lucide-react';
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
      lowStock: inventory.filter(i => i.remainingStock < 10).length
    };
  }, [materials, inventory]);

  const chartData = useMemo(() => {
    return inventory.slice(0, 8).map(item => {
      const mat = materials.find(m => m.id === item.materialId);
      return {
        name: mat?.name || 'Unknown',
        remaining: item.remainingStock,
        inbound: item.todayInbound
      };
    });
  }, [materials, inventory]);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="物料总数 Total Materials" 
          value={stats.totalMaterials} 
          icon={<Package className="text-blue-500" />} 
          bgColor="bg-blue-50"
        />
        <StatCard 
          label="今日入库 Today Inbound" 
          value={stats.totalIn} 
          icon={<TrendingUp className="text-green-500" />} 
          bgColor="bg-green-50"
        />
        <StatCard 
          label="车间出库 Workshop Out" 
          value={stats.totalWorkshopOut} 
          icon={<TrendingDown className="text-orange-500" />} 
          bgColor="bg-orange-50"
        />
        <StatCard 
          label="店面出库 Store Out" 
          value={stats.totalStoreOut} 
          icon={<ShoppingBag className="text-purple-500" />} 
          bgColor="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800">库存概况 Stock Overview (Top 8)</h3>
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Today</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="remaining" radius={[4, 4, 0, 0]} name="剩余库存 Remaining">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.remaining < 10 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">库存预警 Low Stock Alerts</h3>
          <div className="space-y-4">
            {inventory.filter(i => i.remainingStock < 10).length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10">No low stock items today.</p>
            ) : (
              inventory.filter(i => i.remainingStock < 10).map(item => {
                const mat = materials.find(m => m.id === item.materialId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                    <div>
                      <p className="font-semibold text-red-900">{mat?.name}</p>
                      <p className="text-xs text-red-600">剩余: {item.remainingStock} {mat?.unit}</p>
                    </div>
                    <div className="text-red-500">
                      <AlertCircle size={20} />
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

const StatCard = ({ label, value, icon, bgColor }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
    </div>
    <div className={`p-3 rounded-xl ${bgColor}`}>
      {icon}
    </div>
  </div>
);

const AlertCircle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default Dashboard;
