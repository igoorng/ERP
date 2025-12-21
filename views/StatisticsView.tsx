
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Search, Calendar, BarChart3, TrendingUp, TrendingDown, ShoppingBag, Calculator, Info, Loader2, Package } from 'lucide-react';

const StatisticsView: React.FC = () => {
  const today = db.getBeijingDate();
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekStr = lastWeekDate.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(lastWeekStr);
  const [endDate, setEndDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [statsData, setStatsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await db.getAggregatedStatistics(startDate, endDate);
      setStatsData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const filteredStats = useMemo(() => {
    return statsData.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [statsData, searchTerm]);

  const rangeTotals = useMemo(() => {
    return filteredStats.reduce((acc, curr) => ({
      in: acc.in + (curr.totalIn || 0),
      workshop: acc.workshop + (curr.totalWorkshop || 0),
      store: acc.store + (curr.totalStore || 0)
    }), { in: 0, workshop: 0, store: 0 });
  }, [filteredStats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
      {/* 筛选区域 */}
      <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索物料历史..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold outline-none text-sm"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={14} />
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-9 pr-3 py-3 bg-blue-50/50 border border-blue-100 rounded-xl font-black text-blue-700 outline-none text-xs"
            />
          </div>
          <span className="text-gray-300 font-bold hidden sm:block">-</span>
          <div className="relative flex-1 w-full">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={14} />
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-9 pr-3 py-3 bg-blue-50/50 border border-blue-100 rounded-xl font-black text-blue-700 outline-none text-xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
           <Loader2 className="animate-spin mb-4" size={48} />
           <p className="font-black text-xs uppercase">正在计算数据快照...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-6">
            <SummaryCard label="期间入库" value={rangeTotals.in} icon={<TrendingUp size={18}/>} color="blue" />
            <SummaryCard label="车间出库" value={rangeTotals.workshop} icon={<TrendingDown size={18}/>} color="orange" />
            <SummaryCard label="店面出库" value={rangeTotals.store} icon={<ShoppingBag size={18}/>} color="purple" />
          </div>

          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
               <h3 className="font-black text-gray-800 text-sm lg:text-base flex items-center">
                 <BarChart3 className="mr-2 text-blue-500" size={18} />
                 物料阶段明细
               </h3>
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-full">
                 截至: {endDate}
               </span>
            </div>
            
            {/* 桌面表格 */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                  <tr>
                    <th className="px-8 py-5">物料名称</th>
                    <th className="px-6 py-5 text-center">入库</th>
                    <th className="px-6 py-5 text-center">车间出库</th>
                    <th className="px-6 py-5 text-center">店面出库</th>
                    <th className="px-8 py-5 text-center bg-blue-50/50 text-blue-800">当前剩余</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredStats.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-8 py-5 font-black text-gray-900">{item.name}</td>
                      <td className="px-6 py-5 text-center font-bold text-blue-600">{item.totalIn}</td>
                      <td className="px-6 py-5 text-center font-bold text-orange-600">{item.totalWorkshop}</td>
                      <td className="px-6 py-5 text-center font-bold text-purple-600">{item.totalStore}</td>
                      <td className="px-8 py-5 text-center font-black text-blue-900 bg-blue-50/20">{item.currentStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手机卡片列表 */}
            <div className="lg:hidden divide-y divide-gray-50">
              {filteredStats.map((item, idx) => (
                <div key={idx} className="p-4 flex justify-between items-center">
                  <div>
                    <h5 className="font-black text-gray-900 text-sm">{item.name}</h5>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[9px] font-bold text-blue-500">入:{item.totalIn}</span>
                      <span className="text-[9px] font-bold text-orange-500">车:{item.totalWorkshop}</span>
                      <span className="text-[9px] font-bold text-purple-500">店:{item.totalStore}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-400 uppercase">期末结余</p>
                    <p className="text-xl font-black text-blue-900 leading-none mt-1">{item.currentStock}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, icon, color }: any) => {
  const themes: any = {
    blue: 'bg-blue-600 text-white shadow-blue-200',
    orange: 'bg-orange-500 text-white shadow-orange-200',
    purple: 'bg-purple-600 text-white shadow-purple-200'
  };
  return (
    <div className={`p-4 lg:p-6 rounded-2xl lg:rounded-[2.5rem] shadow-xl flex items-center space-x-4 ${themes[color]}`}>
      <div className="w-10 h-10 lg:w-14 lg:h-14 bg-white/20 backdrop-blur-md rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">{label}</p>
        <h4 className="text-xl lg:text-3xl font-black tracking-tighter">{value}</h4>
      </div>
    </div>
  );
};

export default StatisticsView;
