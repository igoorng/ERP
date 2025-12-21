
import React, { useMemo, useEffect, useState } from 'react';
import { db } from '../services/db';
import { Package, TrendingUp, TrendingDown, ShoppingBag, AlertTriangle, Clock, Loader2, Settings, RefreshCw } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [todayStr, setTodayStr] = useState(db.getBeijingDate());
  const [currentTime, setCurrentTime] = useState(db.getBeijingTimeOnly());
  const [materials, setMaterials] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 这里的初始化在后端 D1 中是事务性的
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
      console.error("Dashboard fetch error:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 设置每 30 秒自动静默刷新一次核心数据
    const refreshInterval = setInterval(() => fetchData(true), 30000);
    const clockInterval = setInterval(() => {
      setCurrentTime(db.getBeijingTimeOnly());
      const nowDate = db.getBeijingDate();
      if (nowDate !== todayStr) setTodayStr(nowDate);
    }, 1000);
    
    return () => {
      clearInterval(refreshInterval);
      clearInterval(clockInterval);
    };
  }, [todayStr]);

  const stats = useMemo(() => {
    const threshold = Number(settings.LOW_STOCK_THRESHOLD || 10);
    return inventory.reduce((acc, item) => ({
      totalIn: acc.totalIn + (item.todayInbound || 0),
      totalWorkshop: acc.totalWorkshop + (item.workshopOutbound || 0),
      totalStore: acc.totalStore + (item.storeOutbound || 0),
      lowStockCount: acc.lowStockCount + (item.remainingStock < threshold ? 1 : 0)
    }), { totalIn: 0, totalWorkshop: 0, totalStore: 0, lowStockCount: 0 });
  }, [inventory, settings.LOW_STOCK_THRESHOLD]);

  const lowStockItems = useMemo(() => {
    const threshold = Number(settings.LOW_STOCK_THRESHOLD || 10);
    return inventory.filter(i => i.remainingStock < threshold);
  }, [inventory, settings.LOW_STOCK_THRESHOLD]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-gray-400">
        <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
        <p className="font-black">正在聚合 D1 实时统计看板数据...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">{settings.SYSTEM_NAME || 'MaterialFlow Pro'}</h2>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">
            {todayStr} • 智能物料流动监控系统
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => fetchData()}
            className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-blue-600 transition-all shadow-sm"
          >
            <RefreshCw size={18} />
          </button>
          <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center space-x-3 shadow-xl shadow-slate-200">
            <Clock size={18} className="text-blue-400" />
            <span className="font-black text-lg">{currentTime}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="物料品种" value={materials.length} color="blue" icon={<Package size={24}/>} />
        <StatCard label="今日入库" value={stats.totalIn} color="green" icon={<TrendingUp size={24}/>} />
        <StatCard label="车间出库" value={stats.totalWorkshop} color="orange" icon={<TrendingDown size={24}/>} />
        <StatCard label="店面出库" value={stats.totalStore} color="purple" icon={<ShoppingBag size={24}/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
           <div className="flex items-center justify-between mb-8">
             <div className="flex items-center space-x-3">
               <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                 <AlertTriangle size={24} />
               </div>
               <div>
                 <h3 className="font-black text-gray-900">低库存预警列表</h3>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">阈值关联: {settings.LOW_STOCK_THRESHOLD}</p>
               </div>
             </div>
             <span className="bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-red-100">
               {stats.lowStockCount} 项异常
             </span>
           </div>
           
           <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
              {lowStockItems.map(item => {
                const mat = materials.find(m => m.id === item.materialId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-5 bg-red-50/30 rounded-[1.5rem] border border-red-100/50 hover:bg-red-50 transition-all">
                    <div>
                      <p className="font-black text-gray-900 text-lg">{mat?.name}</p>
                      <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-0.5">需要立即补货</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-red-600">{item.remainingStock}</p>
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{mat?.unit}</p>
                    </div>
                  </div>
                );
              })}
              {stats.lowStockCount === 0 && (
                <div className="py-20 text-center text-gray-300">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package size={32} />
                  </div>
                  <p className="font-black text-gray-400">当前所有物料库存充足</p>
                </div>
              )}
           </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
           <div className="absolute -top-10 -right-10 p-12 bg-blue-600/10 rounded-full blur-3xl opacity-50"></div>
           <div className="relative z-10">
             <h3 className="font-black text-blue-400 text-xs uppercase tracking-widest mb-8">云端引擎运行状态</h3>
             <div className="space-y-6">
               <StatusItem label="数据存储层" value="Cloudflare D1" />
               <StatusItem label="物料安全审计" value="已开启加密" />
               <StatusItem label="实时级联重算" value="底层触发器" />
               <StatusItem label="最后同步时间" value={currentTime} />
             </div>
           </div>
           
           <div className="mt-12 pt-8 border-t border-white/5 relative z-10">
             <div className="flex items-center justify-between mb-6">
                <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">系统版本</p>
                   <p className="text-sm font-black text-white">V1.5 Pro Stable</p>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl">
                   <Settings className="text-slate-400" size={20} />
                </div>
             </div>
             <p className="text-xs text-slate-400 font-medium leading-relaxed">
               MaterialFlow Pro 运行在 Cloudflare 全球边缘网络，确保亚毫秒级的交互体验。
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center space-x-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className={`p-4 rounded-2xl ${colors[color]} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">{label}</p>
        <p className="text-3xl font-black text-gray-900 tracking-tighter truncate">{value}</p>
      </div>
    </div>
  );
};

const StatusItem = ({ label, value }: any) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-slate-400 font-black tracking-tight">{label}</span>
    <div className="flex items-center">
      <span className="text-xs font-black mr-3 text-slate-200">{value}</span>
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
    </div>
  </div>
);

export default Dashboard;
