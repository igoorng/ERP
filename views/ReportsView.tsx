
import React, { useState } from 'react';
import { db } from '../services/db';
import { Download, Calendar, FileSpreadsheet } from 'lucide-react';

declare const XLSX: any;

const ReportsView: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const exportDailyData = () => {
    const materials = db.getMaterials();
    const inventory = db.getInventoryForDate(date);
    
    const exportData = inventory.map(item => {
      const mat = materials.find(m => m.id === item.materialId);
      return {
        '物料名称': mat?.name,
        '物料单位': mat?.unit,
        '实时库存 (期初)': item.openingStock,
        '今日入库': item.todayInbound,
        '车间出库': item.workshopOutbound,
        '店面出库': item.storeOutbound,
        '今日剩余库存 (期末)': item.remainingStock,
        '日期': item.date
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Inventory_${date}`);
    XLSX.writeFile(workbook, `Inventory_Report_${date}.xlsx`);
    
    db.logAction('EXPORT', `Exported inventory report for date: ${date}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileSpreadsheet className="text-blue-600" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">每日报表导出 Daily Export</h2>
        <p className="text-gray-500 mb-8">选择日期并导出当日的库存快照信息。包含期初库存、入库、出库及期末剩余库存。</p>
        
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full max-w-xs">
            <label className="block text-left text-sm font-medium text-gray-700 mb-1">选择统计日期 Select Date</label>
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
            className="w-full max-w-xs py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center space-x-2 transform active:scale-95"
          >
            <Download size={20} />
            <span>导出 Excel (.xlsx)</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h4 className="font-semibold text-gray-700 mb-2">包含字段 Included Fields</h4>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• 物料名称 & 单位</li>
            <li>• 期初/实时库存 (Opening)</li>
            <li>• 入库总量 (Inbound)</li>
            <li>• 出库总量 (Outbound)</li>
            <li>• 最终剩余库存 (Remaining)</li>
          </ul>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h4 className="font-semibold text-gray-700 mb-2">使用说明 Usage</h4>
          <p className="text-sm text-gray-500 leading-relaxed">
            导出的数据可直接用于次日的物料盘点与审计。系统会自动记录此次导出操作。
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
