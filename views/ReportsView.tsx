
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/db';
import { Download, Calendar, FileSpreadsheet, CheckCircle, Circle, Loader2 } from 'lucide-react';

declare const XLSX: any;

const AVAILABLE_COLUMNS = [
  { id: 'name', label: '物料名称', key: '物料名称' },
  { id: 'unit', label: '物料单位', key: '物料单位' },
  { id: 'opening', label: '昨日库存', key: '昨日库存 (期初)' },
  { id: 'inbound', label: '今日入库', key: '今日入库' },
  { id: 'workshop', label: '车间出库', key: '车间出库' },
  { id: 'store', label: '店面出库', key: '店面出库' },
  { id: 'remaining', label: '剩余库存', key: '今日剩余库存 (期末)' },
  { id: 'date', label: '统计日期', key: '日期' },
];

const ReportsView: React.FC = () => {
  const [maxDate, setMaxDate] = useState(db.getBeijingDate());
  const [date, setDate] = useState(db.getBeijingDate());
  const [loading, setLoading] = useState(false);
  const [selectedCols, setSelectedCols] = useState<string[]>(['name', 'unit', 'remaining']);

  useEffect(() => {
    // 每次进入页面刷新一次最大日期
    setMaxDate(db.getBeijingDate());
    setDate(db.getBeijingDate());
  }, []);

  const toggleColumn = (id: string) => {
    if (selectedCols.includes(id)) {
      if (selectedCols.length > 1) {
        setSelectedCols(selectedCols.filter(c => c !== id));
      }
    } else {
      setSelectedCols([...selectedCols, id]);
    }
  };

  const exportDailyData = async () => {
    if (date > maxDate) {
      alert("无法导出未来日期的报表");
      return;
    }

    setLoading(true);
    try {
      const [materials, inventory] = await Promise.all([
        db.getMaterials(),
        db.getInventoryForDate(date)
      ]);
      
      if (inventory.length === 0) {
        alert(`${date} 暂无任何库存数据。`);
        return;
      }

      const exportData = inventory.map(item => {
        const mat = materials.find(m => m.id === item.materialId);
        const row: any = {};
        
        AVAILABLE_COLUMNS.forEach(col => {
          if (selectedCols.includes(col.id)) {
            switch (col.id) {
              case 'name': row[col.key] = mat?.name; break;
              case 'unit': row[col.key] = mat?.unit; break;
              case 'opening': row[col.key] = item.openingStock; break;
              case 'inbound': row[col.key] = item.todayInbound; break;
              case 'workshop': row[col.key] = item.workshopOutbound; break;
              case 'store': row[col.key] = item.storeOutbound; break;
              case 'remaining': row[col.key] = item.remainingStock; break;
              case 'date': row[col.key] = item.date; break;
            }
          }
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Inventory_${date}`);
      XLSX.writeFile(workbook, `MaterialFlow_Inventory_${date}.xlsx`);
      
      db.logAction('EXPORT', `导出报表: 日期 ${date}, 字段数 ${selectedCols.length}`);
    } catch (e) {
      alert('导出失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-8 lg:p-12 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
        
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-50">
            <FileSpreadsheet size={40} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">定制报表中心</h2>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Flexible Excel Report Generation</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* 配置侧 */}
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">第一步：选择导出日期 (截止今日)</label>
              <div className="relative group">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 transition-transform group-focus-within:scale-110" size={20} />
                <input
                  type="date"
                  max={maxDate}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none font-black text-gray-700 transition-all"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={exportDailyData}
              disabled={loading}
              className={`
                w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-2xl shadow-blue-200 transition-all flex items-center justify-center space-x-3 transform active:scale-95
                ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}
              `}
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <Download size={24} />}
              <span className="text-lg">生成并导出 Excel</span>
            </button>
          </div>

          {/* 字段侧 */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">第二步：勾选需要导出的列</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AVAILABLE_COLUMNS.map(col => {
                const isSelected = selectedCols.includes(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`
                      flex items-center p-4 rounded-2xl border-2 transition-all text-sm font-black
                      ${isSelected 
                        ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-md shadow-blue-50' 
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}
                    `}
                  >
                    {isSelected ? (
                      <CheckCircle size={18} className="mr-3 text-blue-600" />
                    ) : (
                      <Circle size={18} className="mr-3 text-gray-200" />
                    )}
                    {col.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 font-bold italic text-center mt-4">
              * 建议至少保留“物料名称”与“剩余库存”
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-900 p-6 rounded-[2rem] text-white flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-4">
           <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
             <Download className="text-blue-400" size={20} />
           </div>
           <div>
             <p className="text-xs font-black uppercase tracking-widest text-slate-500">导出预览预览</p>
             <p className="text-sm font-bold">MaterialFlow_Inventory_{date}.xlsx</p>
           </div>
        </div>
        <div className="text-right">
           <p className="text-xs font-black text-slate-500 mb-1">选中字段数</p>
           <span className="px-3 py-1 bg-blue-600 rounded-lg font-black text-xs">{selectedCols.length} Columns</span>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
