
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
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const clockInterval = setInterval(() => {
      setCurrentTime(db.getBeijingTimeOnly());
      const nowDate = db.getBeijingDate();
      if (nowDate !== todayStr) setTodayStr(nowDate);
    }, 1000);
    return () => clearInterval(clockInterval);
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
        <p className="font-black text-sm">加载看板数据...</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 animate-in fade-in duration-700 pb-20 lg:pb-0 min-h-full overflow-hidden lg:overflow-visible">
      
      {/* PC 端专属装饰背景 - 仅在 lg 屏幕显示 */}
      <div className="hidden lg:block absolute -z-10 inset-0 pointer-events-none">
        {/* 右上角流体色块 */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[120px] animate-pulse duration-[10s]"></div>
        {/* 左下角流体色块 */}
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse duration-[15s]"></div>
        {/* 几何网格纹理 */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
      </div>

      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 relative z-10">
        <div>
          <div className="flex items-center space-x-3 mb-1">
             <div className="h-8 w-1.5 bg-blue-600 rounded-full hidden lg:block"></div>
             <h2 className="text-2xl lg:text-4xl font-black text-gray-900 tracking-tight">{settings.SYSTEM_NAME || '物料流控 Pro'}</h2>
          </div>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] ml-0 lg:ml-4">{todayStr} • 实时库存仪表盘</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => fetchData()} className="p-3 bg-white/80 backdrop-blur-md border border-gray-100 rounded-xl text-gray-400 hover:text-blue-600 hover:shadow-lg transition-all active:scale-90"><RefreshCw size={18}/></button>
          <div className="bg-slate-950 text-white px-5 py-3 rounded-2xl flex items-center space-x-3 shadow-2xl shadow-slate-200">
            <Clock size={18} className="text-blue-400" />
            <span className="font-black text-lg tracking-tight">{currentTime}</span>
          </div>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-8 relative z-10">
        <StatCard label="物料品种" value={materials.length} color="blue" icon={<Package size={22}/>} />
        <StatCard label="今日入库" value={stats.totalIn} color="green" icon={<TrendingUp size={22}/>} />
        <StatCard label="车间出库" value={stats.totalWorkshop} color="orange" icon={<TrendingDown size={22}/>} />
        <StatCard label="店面出库" value={stats.totalStore} color="purple" icon={<ShoppingBag size={22}/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 relative z-10">
        {/* 预警列表卡片 - 增加玻璃拟态质感 */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] border border-white/40 shadow-xl shadow-gray-200/50">
           <div className="flex items-center justify-between mb-8">
             <div className="flex items-center space-x-4">
               <div className="p-4 bg-red-50 text-red-600 rounded-2xl lg:rounded-3xl shadow-inner">
                 <AlertTriangle size={24} />
               </div>
               <div>
                 <h3 className="font-black text-gray-900 text-lg lg:text-xl">库存预警</h3>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">告警阈值: {settings.LOW_STOCK_THRESHOLD}</p>
               </div>
             </div>
             <div className="bg-red-600 text-white px-5 py-1.5 rounded-full text-xs font-black shadow-lg shadow-red-200 animate-bounce-subtle">
               {stats.lowStockCount} 项异常
             </div>
           </div>
           
           <div className="space-y-4 max-h-[350px] lg:max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {lowStockItems.map(item => {
                const mat = materials.find(m => m.id === item.materialId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-5 bg-gradient-to-r from-red-50/50 to-white rounded-2xl lg:rounded-3xl border border-red-100/50 hover:shadow-md transition-all group">
                    <div className="flex items-center space-x-4">
                       <div className="w-1.5 h-10 bg-red-300 rounded-full group-hover:h-12 transition-all"></div>
                       <div>
                         <p className="font-black text-gray-900 text-base lg:text-xl">{mat?.name}</p>
                         <p className="text-[10px] text-red-400 font-black uppercase tracking-wider">STATUS: IMMEDIATE REPLENISHMENT</p>
                       </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl lg:text-4xl font-black text-red-600 tracking-tighter">{item.remainingStock}</p>
                      <p className="text-[10px] text-gray-400 font-black uppercase">{mat?.unit}</p>
                    </div>
                  </div>
                );
              })}
              {stats.lowStockCount === 0 && (
                <div className="py-20 text-center text-gray-300 flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Package className="text-gray-200" size={32} />
                  </div>
                  <p className="font-black text-sm uppercase tracking-[0.3em]">仓库状态极佳</p>
                </div>
              )}
           </div>
        </div>

        {/* 侧边信息卡片 - 深色玻璃质感 */}
        <div className="bg-slate-950 p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col justify-between group">
           {/* 卡片内部动态装饰 */}
           <div className="absolute -top-10 -right-10 p-20 bg-blue-600/20 rounded-full blur-[80px] group-hover:scale-125 transition-transform duration-1000"></div>
           <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
           
           <div className="relative z-10">
             <div className="flex items-center space-x-2 mb-10">
                <Settings size={14} className="text-blue-400 animate-spin-slow" />
                <h3 className="font-black text-blue-400 text-[10px] uppercase tracking-[0.3em]">CORE INFRASTRUCTURE</h3>
             </div>
             <div className="space-y-6">
               <StatusItem label="核心引擎" value="Cloudflare D1" />
               <StatusItem label="数据状态" value="100% 同步" />
               <StatusItem label="安全协议" value="AES-256-GCM" />
               <StatusItem label="部署节点" value="Edge Global" />
             </div>
           </div>
           
           <div className="pt-10 relative z-10">
             <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-black mb-1 uppercase tracking-widest">VERSION CONTROL</p>
                  <p className="text-sm font-black text-white">v1.8 Enterprise</p>
                </div>
                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-blue-600 flex items-center justify-center text-[8px] font-black">
                       {i}
                     </div>
                   ))}
                </div>
             </div>
           </div>
        </div>
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 shadow-blue-100/50',
    green: 'bg-emerald-50 text-emerald-600 shadow-emerald-100/50',
    orange: 'bg-orange-50 text-orange-600 shadow-orange-100/50',
    purple: 'bg-purple-50 text-purple-600 shadow-purple-100/50',
  };
  return (
    <div className="bg-white/80 backdrop-blur-md p-5 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] shadow-lg shadow-gray-100/50 border border-white/60 flex flex-col lg:flex-row items-center lg:items-center gap-4 lg:gap-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
      <div className={`p-4 lg:p-6 rounded-2xl lg:rounded-[1.8rem] ${colors[color]} shadow-lg`}>{icon}</div>
      <div className="text-center lg:text-left min-w-0">
        <p className="text-[9px] lg:text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5 truncate">{label}</p>
        <p className="text-2xl lg:text-4xl font-black text-gray-900 tracking-tighter truncate">{value}</p>
      </div>
    </div>
  );
};

const StatusItem = ({ label, value }: any) => (
  <div className="flex items-center justify-between group/item">
    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider group-hover/item:text-slate-300 transition-colors">{label}</span>
    <div className="flex items-center">
      <span className="text-xs font-black mr-3 text-slate-200">{value}</span>
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]"></div>
    </div>
  </div>
);

export default Dashboard;
