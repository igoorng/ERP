
import React, { useState } from 'react';
import { db } from '../services/db';
import { Download, Calendar, FileSpreadsheet, CheckCircle, Circle } from 'lucide-react';

declare const XLSX: any;

const AVAILABLE_COLUMNS = [
  { id: 'name', label: '物料名称', key: '物料名称' },
  { id: 'unit', label: '物料单位', key: '物料单位' },
  { id: 'opening', label: '期初库存', key: '实时库存 (期初)' },
  { id: 'inbound', label: '今日入库', key: '今日入库' },
  { id: 'workshop', label: '车间出库', key: '车间出库' },
  { id: 'store', label: '店面出库', key: '店面出库' },
  { id: 'remaining', label: '剩余库存', key: '今日剩余库存 (期末)' },
  { id: 'date', label: '统计日期', key: '日期' },
];

const ReportsView: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCols, setSelectedCols] = useState<string[]>(AVAILABLE_COLUMNS.map(c => c.id));

  const toggleColumn = (id: string) => {
    if (selectedCols.includes(id)) {
      if (selectedCols.length > 1) {
        setSelectedCols(selectedCols.filter(c => c !== id));
      }
    } else {
      setSelectedCols([...selectedCols, id]);
    }
  };

  const exportDailyData = () => {
    const materials = db.getMaterials();
    const inventory = db.getInventoryForDate(date);
    
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
    XLSX.writeFile(workbook, `Inventory_Report_${date}.xlsx`);
    
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
          <p className="text-gray-500">灵活选择导出的物料字段与统计日期</p>
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
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
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
            文件名格式为: <code className="bg-white px-1 rounded border">Inventory_Report_{date}.xlsx</code>
          </p>
        </div>
        <div className="bg-gray-50/50 p-5 rounded-xl border border-dashed border-gray-200">
          <h4 className="font-bold text-gray-800 mb-2 flex items-center">
            <History size={16} className="mr-2 text-blue-500" />
            使用建议
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed">
            通常建议保留“物料名称”、“单位”以及“剩余库存”作为必选字段，以便后续复盘使用。
          </p>
        </div>
      </div>
    </div>
  );
};

const History = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export default ReportsView;
