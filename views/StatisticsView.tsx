
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Search, Calendar, BarChart3, TrendingUp, TrendingDown, ShoppingBag, Calculator, Info } from 'lucide-react';

const StatisticsView: React.FC = () => {
  const today = db.getBeijingDate();
  
  // 默认查看最近 7 天
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekStr = lastWeek.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(lastWeekStr);
  const [endDate, setEndDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [statsData, setStatsData] = useState<any[]>([]);

  // Fixed: added async/await to the effect callback
  useEffect(() => {
    const fetchData = async () => {
      const data = await db.getAggregatedStatistics(startDate, endDate);
      setStatsData(data);
    };
    fetchData();
  }, [startDate, endDate]);

  const filteredStats = useMemo(() => {
    return statsData.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [statsData, searchTerm]);

  // 计算范围总计
  const rangeTotals = useMemo(() => {
    return filteredStats.reduce((acc, curr) => ({
      in: acc.in + curr.totalIn,
      workshop: acc.workshop + curr.totalWorkshop,
      store: acc.store + curr.totalStore
    }), { in: 0, workshop: 0, store: 0 });
  }, [filteredStats]);

  return (
    <div className="space-y-6">
      {/* 筛选区域 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="搜索物料名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold outline-none transition-all"
          />
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative group flex-1 lg:flex-none">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full lg:w-44 pl-10 pr-3 py-3 bg-blue-50/50 border border-blue-100 rounded-xl font-black text-blue-700 outline-none text-xs"
            />
          </div>
          <span className="text-gray-400 font-bold">至</span>
          <div className="relative group flex-1 lg:flex-none">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full lg:w-44 pl-10 pr-3 py-3 bg-blue-50/50 border border-blue-100 rounded-xl font-black text-blue-700 outline-none text-xs"
            />
          </div>
        </div>
      </div>

      {/* 范围汇总统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard 
          label="时间段内总入库" 
          value={rangeTotals.in} 
          icon={<TrendingUp size={24}/>} 
          color="blue" 
        />
        <SummaryCard 
          label="时间段内车间总出库" 
          value={rangeTotals.workshop} 
          icon={<TrendingDown size={24}/>} 
          color="orange" 
        />
        <SummaryCard 
          label="时间段内店面总出库" 
          value={rangeTotals.store} 
          icon={<ShoppingBag size={24}/>} 
          color="purple" 
        />
      </div>

      {/* 数据列表 */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
           <h3 className="font-black text-gray-800 flex items-center tracking-tight">
             <BarChart3 className="mr-2 text-blue-500" size={20} />
             物料使用明细统计
           </h3>
           <div className="flex items-center text-[10px] font-black text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
             <Info size={12} className="mr-1.5" />
             今日剩余为截至所选日期的最新库存
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
              <tr>
                <th className="px-8 py-5">物料名称</th>
                <th className="px-6 py-5 text-center">单位</th>
                <th className="px-6 py-5 text-center text-blue-600">总入库</th>
                <th className="px-6 py-5 text-center text-orange-600">总车间出库</th>
                <th className="px-6 py-5 text-center text-purple-600">总店面出库</th>
                <th className="px-8 py-5 text-center bg-blue-50 text-blue-800">今日/期末剩余</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <Calculator size={48} />
                      <p className="mt-4 font-black">所选日期范围内暂无业务变动</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStats.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-5 font-black text-gray-900">{item.name}</td>
                    <td className="px-6 py-5 text-center">
                      <span className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-500">{item.unit}</span>
                    </td>
                    <td className="px-6 py-5 text-center font-mono font-bold text-blue-600">{item.totalIn}</td>
                    <td className="px-6 py-5 text-center font-mono font-bold text-orange-600">{item.totalWorkshop}</td>
                    <td className="px-6 py-5 text-center font-mono font-bold text-purple-600">{item.totalStore}</td>
                    <td className="px-8 py-5 text-center font-black text-blue-900 bg-blue-50/30 text-lg group-hover:bg-blue-50/50 transition-colors">
                      {item.currentStock}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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
    <div className={`p-6 rounded-[2.5rem] shadow-xl flex items-center space-x-5 ${themes[color]}`}>
      <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{label}</p>
        <h4 className="text-3xl font-black tracking-tighter">{value}</h4>
      </div>
    </div>
  );
};

export default StatisticsView;
