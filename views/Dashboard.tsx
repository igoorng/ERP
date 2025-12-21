
import React, { useMemo, useEffect, useState } from 'react';
import { db } from '../services/db';
import { config } from '../services/config';
import { Package, TrendingUp, TrendingDown, ShoppingBag, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Dashboard: React.FC = () => {
  const [todayStr, setTodayStr] = useState(db.getBeijingDate());
  const [currentTime, setCurrentTime] = useState(db.getBeijingTimeOnly());
  const [materials, setMaterials] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      await db.initializeDate(todayStr);
      const [mats, inv] = await Promise.all([
        db.getMaterials(),
        db.getInventoryForDate(todayStr)
      ]);
      setMaterials(mats);
      setInventory(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setCurrentTime(db.getBeijingTimeOnly());
      const nowDate = db.getBeijingDate();
      if (nowDate !== todayStr) setTodayStr(nowDate);
    }, 10000);
    return () => clearInterval(interval);
  }, [todayStr]);

  const stats = useMemo(() => {
    return inventory.reduce((acc, item) => ({
      totalIn: acc.totalIn + item.todayInbound,
      totalWorkshop: acc.totalWorkshop + item.workshopOutbound,
      totalStore: acc.totalStore + item.storeOutbound,
    }), { totalIn: 0, totalWorkshop: 0, totalStore: 0 });
  }, [inventory]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-bold">加载实时统计数据...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-gray-900">今日云端概览</h2>
        <div className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center space-x-2">
          <Clock size={16} />
          <span className="font-bold">{currentTime}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="品种" value={materials.length} color="blue" icon={<Package size={20}/>} />
        <StatCard label="入库" value={stats.totalIn} color="green" icon={<TrendingUp size={20}/>} />
        <StatCard label="车间" value={stats.totalWorkshop} color="orange" icon={<TrendingDown size={20}/>} />
        <StatCard label="店面" value={stats.totalStore} color="purple" icon={<ShoppingBag size={20}/>} />
      </div>

      {/* 图表部分保持 Recharts 逻辑，数据源切换到 state 即可 */}
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
    <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>{icon}</div>
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  </div>
);

export default Dashboard;
