
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Upload, Download, Save, RefreshCw } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Load Data
  const loadData = () => {
    const mats = db.getMaterials();
    setMaterials(mats);
    db.initializeDate(date);
    setInventory(db.getInventoryForDate(date));
  };

  useEffect(() => {
    loadData();
  }, [date]);

  const filteredData = useMemo(() => {
    return inventory.filter(item => {
      const mat = materials.find(m => m.id === item.materialId);
      return mat?.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [inventory, materials, searchTerm]);

  const handleInputChange = (materialId: string, field: keyof DailyInventory, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    const updatedInventory = inventory.map(item => {
      if (item.materialId === materialId) {
        const newItem = { ...item, [field]: numValue };
        // Real-time calculation logic
        newItem.remainingStock = newItem.openingStock + newItem.todayInbound - newItem.workshopOutbound - newItem.storeOutbound;
        db.saveInventoryRecord(newItem);
        return newItem;
      }
      return item;
    });
    setInventory(updatedInventory);
    db.logAction('UPDATE', `Updated ${field} for material ID ${materialId}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      // Expecting columns: "物料名称", "物料单位"
      data.forEach((row: any) => {
        const name = row['物料名称'] || row['Name'];
        const unit = row['物料单位'] || row['Unit'];
        if (name && unit) {
          db.addMaterial(name, unit);
        }
      });
      loadData();
      db.logAction('IMPORT', `Imported ${data.length} materials from Excel`);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索物料 Search..."
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <input
            type="date"
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2">
          <label className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors font-medium text-sm">
            <Upload size={18} className="mr-2" />
            导入物料 Import
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
          >
            <Plus size={18} className="mr-2" />
            新增物料 Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">物料名称 Name</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">单位 Unit</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">实时库存 Opening</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-blue-600">今日入库 Inbound</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-orange-600">车间出库 Workshop</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-purple-600">店面出库 Store</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase bg-blue-50">剩余库存 Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    暂无物料数据。请添加或导入。
                  </td>
                </tr>
              ) : (
                filteredData.map(item => {
                  const mat = materials.find(m => m.id === item.materialId);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{mat?.name}</td>
                      <td className="px-6 py-4 text-gray-500">{mat?.unit}</td>
                      <td className="px-6 py-4 font-semibold text-gray-700">{item.openingStock}</td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.todayInbound}
                          onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                          className="w-20 px-2 py-1 border border-blue-200 rounded bg-blue-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.workshopOutbound}
                          onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                          className="w-20 px-2 py-1 border border-orange-200 rounded bg-orange-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.storeOutbound}
                          onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                          className="w-20 px-2 py-1 border border-purple-200 rounded bg-purple-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                      </td>
                      <td className={`px-6 py-4 font-bold bg-blue-50/50 ${item.remainingStock < 10 ? 'text-red-600' : 'text-blue-600'}`}>
                        {item.remainingStock}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Material Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">新增物料 New Material</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={(e: any) => {
              e.preventDefault();
              const name = e.target.name.value;
              const unit = e.target.unit.value;
              db.addMaterial(name, unit);
              loadData();
              setIsAddModalOpen(false);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">物料名称 Material Name</label>
                <input name="name" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：轴承 A-101" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">物料单位 Unit</label>
                <input name="unit" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：个, kg, m" />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">取消 Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">添加 Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default InventoryView;
