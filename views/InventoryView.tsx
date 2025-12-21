
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Upload, Trash2, X, CheckSquare, Square } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load Data
  const loadData = () => {
    const mats = db.getMaterials();
    setMaterials(mats);
    db.initializeDate(date);
    setInventory(db.getInventoryForDate(date));
    setSelectedIds(new Set()); // Reset selection on reload/date change
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
        newItem.remainingStock = newItem.openingStock + newItem.todayInbound - newItem.workshopOutbound - newItem.storeOutbound;
        db.saveInventoryRecord(newItem);
        return newItem;
      }
      return item;
    });
    setInventory(updatedInventory);
    db.logAction('UPDATE', `更新物料 ID ${materialId} 的 ${field} 为 ${numValue}`);
  };

  const handleDeleteMaterial = (id: string, name: string) => {
    if (window.confirm(`确定要删除物料 "${name}" 吗？此操作将同时删除该物料的所有历史库存数据！`)) {
      db.deleteMaterial(id);
      loadData();
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`确定要删除选中的 ${selectedIds.size} 个物料吗？此操作不可撤销！`)) {
      db.deleteMaterials(Array.from(selectedIds));
      loadData();
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(item => item.materialId)));
    }
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

      data.forEach((row: any) => {
        const name = row['物料名称'] || row['Name'];
        const unit = row['物料单位'] || row['Unit'];
        if (name && unit) {
          db.addMaterial(name, unit);
        }
      });
      loadData();
      db.logAction('IMPORT', `从 Excel 导入了 ${data.length} 条物料数据`);
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索物料..."
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
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchDelete}
              className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm border border-red-200"
            >
              <Trash2 size={18} className="mr-2" />
              批量删除 ({selectedIds.size})
            </button>
          )}
          <label className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors font-medium text-sm border border-indigo-200">
            <Upload size={18} className="mr-2" />
            导入物料
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
          >
            <Plus size={18} className="mr-2" />
            新增物料
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-12">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                    {selectedIds.size === filteredData.length && filteredData.length > 0 ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">物料名称</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">单位</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">实时库存</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-blue-600 text-center">今日入库</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-orange-600 text-center">车间出库</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-purple-600 text-center">店面出库</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase bg-blue-50 text-center">今日剩余库存</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                    暂无物料数据。
                  </td>
                </tr>
              ) : (
                filteredData.map(item => {
                  const mat = materials.find(m => m.id === item.materialId);
                  const isSelected = selectedIds.has(item.materialId);
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleSelect(item.materialId)} className="text-gray-400 hover:text-blue-600 transition-colors">
                          {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{mat?.name}</td>
                      <td className="px-6 py-4 text-gray-500">{mat?.unit}</td>
                      <td className="px-6 py-4 font-semibold text-gray-700 text-center">{item.openingStock}</td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          value={item.todayInbound}
                          onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                          className="w-20 px-2 py-1 border border-blue-200 rounded bg-blue-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          value={item.workshopOutbound}
                          onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                          className="w-20 px-2 py-1 border border-orange-200 rounded bg-orange-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-orange-500 text-sm text-center"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          value={item.storeOutbound}
                          onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                          className="w-20 px-2 py-1 border border-purple-200 rounded bg-purple-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-purple-500 text-sm text-center"
                        />
                      </td>
                      <td className={`px-6 py-4 font-bold bg-blue-50/50 text-center ${item.remainingStock < 10 ? 'text-red-600' : 'text-blue-600'}`}>
                        {item.remainingStock}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除物料"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">新增物料</h3>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">物料名称</label>
                <input name="name" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：轴承 A-101" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
                <input name="unit" required className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：个, kg, m" />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">取消</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
