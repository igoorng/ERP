
import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { Download, Calendar, FileSpreadsheet, CheckCircle, Circle } from 'lucide-react';

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
  // 获取当前的北京日期作为截止限制
  const maxDate = useMemo(() => db.getBeijingDate(), []);
  const [date, setDate] = useState(maxDate);
  
  // 默认仅选中 物料名称、物料单位、剩余库存
  const [selectedCols, setSelectedCols] = useState<string[]>(['name', 'unit', 'remaining']);

  const toggleColumn = (id: string) => {
    if (selectedCols.includes(id)) {
      if (selectedCols.length > 1) {
        setSelectedCols(selectedCols.filter(c => c !== id));
      }
    } else {
      setSelectedCols([...selectedCols, id]);
    }
  };

  // Fixed: added async keyword to the function
  const exportDailyData = async () => {
    // 额外校验：防止手动输入绕过 UI 限制
    if (date > maxDate) {
      alert("无法导出未来日期的报表");
      return;
    }

    // Fixed: added await to resolve Promises returned by db calls
    const materials = await db.getMaterials();
    const inventory = await db.getInventoryForDate(date);
    
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
    
    // 更新导出文件名
    XLSX.writeFile(workbook, `数据统计_${date}.xlsx`);
    
    db.logAction('EXPORT', `导出报表: 日期 ${date}, 字段 [${selectedCols.join(', ')}]`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="text-blue-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">定制报表导出</h2>
          <p className="text-gray-500">灵活选择导出的物料字段与统计日期（仅限今日及以前）</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Settings Section */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">第一步：选择日期</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="date"
                  max={maxDate}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <p className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                * 最大可选日期为北京时间今日: {maxDate}
              </p>
            </div>

            <button
              onClick={exportDailyData}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center space-x-2 transform active:scale-95"
            >
              <Download size={20} />
              <span>导出 Excel 报表</span>
            </button>
          </div>

          {/* Column Picker Section */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">第二步：筛选导出字段</label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_COLUMNS.map(col => {
                const isSelected = selectedCols.includes(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`flex items-center p-3 rounded-xl border transition-all text-sm font-medium ${
                      isSelected 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle size={16} className="mr-2 text-blue-600" />
                    ) : (
                      <Circle size={16} className="mr-2 text-gray-300" />
                    )}
                    {col.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-gray-400 italic text-center">
              注：至少需保留一个导出字段
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50/50 p-5 rounded-xl border border-dashed border-gray-200">
          <h4 className="font-bold text-gray-800 mb-2 flex items-center">
            <CheckCircle size={16} className="mr-2 text-green-500" />
            快速预览
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            当前导出的文件将包含 <span className="text-blue-600 font-bold">{selectedCols.length}</span> 个列。
            文件名格式为: <code className="bg-white px-1 rounded border">数据统计_{date}.xlsx</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
