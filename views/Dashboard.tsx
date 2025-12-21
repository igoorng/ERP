
import React, { useMemo, useEffect, useState } from 'react';
import { db } from '../services/db';
import { Package, TrendingUp, TrendingDown, ShoppingBag, AlertTriangle, Clock, Loader2, Settings } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [todayStr, setTodayStr] = useState(db.getBeijingDate());
  const [currentTime, setCurrentTime] = useState(db.getBeijingTimeOnly());
  const [materials, setMaterials] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      await db.initializeDate(todayStr);
      const [mats, inv, sysSettings] = await Promise.all([
        db.getMaterials(),
        db.getInventoryForDate(todayStr),
        db.getSettings()
      ]);
      setMaterials(mats);
      setInventory(inv);
      setSettings(sysSettings);
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
    const threshold = Number(settings.LOW_STOCK_THRESHOLD || 10);
    return inventory.reduce((acc, item) => ({
      totalIn: acc.totalIn + item.todayInbound,
      totalWorkshop: acc.totalWorkshop + item.workshopOutbound,
      totalStore: acc.totalStore + item.storeOutbound,
      lowStockCount: acc.lowStockCount + (item.remainingStock < threshold ? 1 : 0)
    }), { totalIn: 0, totalWorkshop: 0, totalStore: 0, lowStockCount: 0 });
  }, [inventory, settings]);

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
        <div>
          <h2 className="text-2xl font-black text-gray-900">{settings.SYSTEM_NAME || 'MaterialFlow Pro'}</h2>
          <p className="text-sm text-gray-400 font-medium">数据驱动的智能物料监控</p>
        </div>
        <div className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center space-x-2 shadow-lg shadow-blue-200">
          <Clock size={16} />
          <span className="font-bold">{currentTime}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="物料品种" value={materials.length} color="blue" icon={<Package size={20}/>} />
        <StatCard label="今日入库" value={stats.totalIn} color="green" icon={<TrendingUp size={20}/>} />
        <StatCard label="车间出库" value={stats.totalWorkshop} color="orange" icon={<TrendingDown size={20}/>} />
        <StatCard label="店面出库" value={stats.totalStore} color="purple" icon={<ShoppingBag size={20}/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
           <div className="flex items-center justify-between mb-6">
             <h3 className="font-black text-gray-800 flex items-center">
                <AlertTriangle className="mr-2 text-red-500" size={20} />
                低库存预警 (阈值: {settings.LOW_STOCK_THRESHOLD})
             </h3>
             <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black">
               {stats.lowStockCount} 项异常
             </span>
           </div>
           
           <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {inventory.filter(i => i.remainingStock < Number(settings.LOW_STOCK_THRESHOLD || 10)).map(item => {
                const mat = materials.find(m => m.id === item.materialId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-red-50/50 rounded-2xl border border-red-100/50">
                    <div>
                      <p className="font-black text-gray-900">{mat?.name}</p>
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">库存告急</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-red-600">{item.remainingStock}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{mat?.unit}</p>
                    </div>
                  </div>
                );
              })}
              {stats.lowStockCount === 0 && (
                <div className="py-12 text-center text-gray-300">
                  <Package className="mx-auto mb-2 opacity-20" size={48} />
                  <p className="font-bold">暂无物料低于预警值</p>
                </div>
              )}
           </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <Settings size={120} />
           </div>
           <div className="relative z-10">
             <h3 className="font-black text-blue-400 text-sm uppercase tracking-widest mb-2">系统状态</h3>
             <div className="space-y-6 mt-8">
               <StatusItem label="数据库引擎" value="Cloudflare D1" status="normal" />
               <StatusItem label="实时同步" value="已开启" status="normal" />
               <StatusItem label="级联重算" value="后端事务级" status="normal" />
               <StatusItem label="权限审计" value="已激活" status="normal" />
             </div>
             
             <button className="mt-12 w-full py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all font-black text-sm border border-white/10">
               进入系统设置
             </button>
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
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-5 transform hover:scale-[1.02] transition-all">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
      </div>
    </div>
  );
};

const StatusItem = ({ label, value, status }: any) => (
  <div className="flex items-center justify-between group">
    <span className="text-xs text-slate-400 font-bold">{label}</span>
    <div className="flex items-center">
      <span className="text-xs font-black mr-2">{value}</span>
      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
    </div>
  </div>
);

export default Dashboard;
