
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Upload, Trash2, X, CheckSquare, Square, ChevronRight, Calculator } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = () => {
    const mats = db.getMaterials();
    setMaterials(mats);
    db.initializeDate(date);
    const dailyInv = db.getInventoryForDate(date);
    setInventory(dailyInv);
    setSelectedIds(new Set()); 
  };

  useEffect(() => {
    loadData();
  }, [date]);

  const filteredData = useMemo(() => {
    return inventory.filter(item => {
      const mat = materials.find(m => m.id === item.materialId);
      const matName = mat?.name || '';
      return matName.toLowerCase().includes(searchTerm.toLowerCase());
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
    if (window.confirm(`确定要删除物料 "${name}" 吗？`)) {
      db.deleteMaterial(id);
      loadData();
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`确定要删除选中的 ${selectedIds.size} 个物料吗？`)) {
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
    const allFilteredIds = filteredData.map(item => item.materialId);
    const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));

    if (areAllSelected) {
      const next = new Set(selectedIds);
      allFilteredIds.forEach(id => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      allFilteredIds.forEach(id => next.add(id));
      setSelectedIds(next);
    }
  };

  const isAllSelected = filteredData.length > 0 && filteredData.every(item => selectedIds.has(item.materialId));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      data.forEach((row: any) => {
        const name = row['物料名称'] || row['Name'];
        const unit = row['物料单位'] || row['Unit'];
        const initialStock = Number(row['实时库存'] || row['期初库存'] || row['Opening Stock'] || 0);
        if (name && unit) db.addMaterial(name, unit, initialStock, date);
      });
      loadData();
      db.logAction('IMPORT', `从 Excel 导入了 ${data.length} 条数据`);
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; 
  };

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      {/* Search and Filter Header */}
      <div className="bg-white p-3 lg:p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜物料..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="date"
            className="flex-1 sm:flex-none px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 outline-none text-base"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="hidden lg:flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200"
          >
            <Plus size={18} className="mr-2" />
            新增
          </button>
        </div>
      </div>

      {/* Batch Actions for Mobile */}
      {selectedIds.size > 0 && (
        <div className="bg-white p-3 rounded-xl border border-red-100 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <span className="text-sm font-bold text-red-600">已选 {selectedIds.size} 项</span>
          <div className="flex space-x-2">
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg">取消</button>
            <button onClick={handleBatchDelete} className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg flex items-center">
              <Trash2 size={14} className="mr-1" /> 删除
            </button>
          </div>
        </div>
      )}

      {/* PC Table View */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 w-12 text-center">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600">
                  {isAllSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                </button>
              </th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">物料信息</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">期初库存</th>
              <th className="px-6 py-4 text-xs font-bold text-blue-600 uppercase text-center">今日入库</th>
              <th className="px-6 py-4 text-xs font-bold text-orange-600 uppercase text-center">车间出库</th>
              <th className="px-6 py-4 text-xs font-bold text-purple-600 uppercase text-center">店面出库</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-900 uppercase bg-blue-50/50 text-center">剩余库存</th>
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredData.map(item => {
              const mat = materials.find(m => m.id === item.materialId);
              if (!mat) return null;
              const isSelected = selectedIds.has(item.materialId);
              return (
                <tr key={item.id} className={`group ${isSelected ? 'bg-blue-50/20' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => toggleSelect(item.materialId)} className="text-gray-400">
                      {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{mat.name}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">{mat.unit}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-gray-500">{item.openingStock}</td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="number"
                      value={item.todayInbound}
                      onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                      className="w-20 px-2 py-1.5 border border-blue-100 rounded-lg text-center font-bold text-blue-600 bg-blue-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="number"
                      value={item.workshopOutbound}
                      onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                      className="w-20 px-2 py-1.5 border border-orange-100 rounded-lg text-center font-bold text-orange-600 bg-orange-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="number"
                      value={item.storeOutbound}
                      onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                      className="w-20 px-2 py-1.5 border border-purple-100 rounded-lg text-center font-bold text-purple-600 bg-purple-50/30 focus:bg-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-center font-black text-blue-700 bg-blue-50/20">{item.remainingStock}</td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleDeleteMaterial(item.materialId, mat.name)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {filteredData.length === 0 ? (
          <div className="py-20 text-center text-gray-400">暂无物料数据</div>
        ) : (
          filteredData.map(item => {
            const mat = materials.find(m => m.id === item.materialId);
            if (!mat) return null;
            const isSelected = selectedIds.has(item.materialId);
            return (
              <div key={item.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${isSelected ? 'border-blue-200 bg-blue-50/10' : 'border-gray-100'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => toggleSelect(item.materialId)} className="text-gray-300">
                      {isSelected ? <CheckSquare size={24} className="text-blue-600" /> : <Square size={24} />}
                    </button>
                    <div>
                      <h4 className="text-lg font-black text-gray-900 leading-tight">{mat.name}</h4>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">单位: {mat.unit}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteMaterial(item.materialId, mat.name)} className="p-2 text-gray-300 hover:text-red-500">
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                   <div className="bg-gray-50 p-2 rounded-xl text-center">
                     <span className="block text-[10px] text-gray-400 font-bold mb-1">期初</span>
                     <span className="block font-mono font-bold text-gray-600">{item.openingStock}</span>
                   </div>
                   <div className="col-span-3 grid grid-cols-3 gap-2">
                     <div className="text-center">
                        <label className="block text-[10px] text-blue-600 font-bold mb-1">入库</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={item.todayInbound}
                          onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                          className="w-full py-2 bg-blue-50/50 border border-blue-100 rounded-lg text-center font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                     </div>
                     <div className="text-center">
                        <label className="block text-[10px] text-orange-600 font-bold mb-1">车间</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={item.workshopOutbound}
                          onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                          className="w-full py-2 bg-orange-50/50 border border-orange-100 rounded-lg text-center font-bold text-orange-700 outline-none focus:ring-2 focus:ring-orange-500"
                        />
                     </div>
                     <div className="text-center">
                        <label className="block text-[10px] text-purple-600 font-bold mb-1">店面</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={item.storeOutbound}
                          onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                          className="w-full py-2 bg-purple-50/50 border border-purple-100 rounded-lg text-center font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-500"
                        />
                     </div>
                   </div>
                </div>

                <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
                  <div className="flex items-center text-xs font-bold text-gray-500">
                    <Calculator size={14} className="mr-1" />
                    今日实时计算
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400 font-medium">剩余:</span>
                    <span className={`text-xl font-black ${item.remainingStock < 10 ? 'text-red-600' : 'text-blue-600'}`}>{item.remainingStock}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button for Mobile */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all z-50 border-4 border-white"
      >
        <Plus size={30} />
      </button>

      {/* Import/Upload for Mobile - Integrated into options or just as a small button */}
      <div className="flex justify-center py-4 lg:hidden">
         <label className="flex items-center px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 shadow-sm active:bg-gray-50">
           <Upload size={16} className="mr-2" /> 导入 Excel
           <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
         </label>
      </div>

      {/* Modals remain mostly the same but ensure they are w-full on mobile */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in slide-in-from-bottom duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900">新增物料</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={(e: any) => {
              e.preventDefault();
              db.addMaterial(e.target.name.value, e.target.unit.value, Number(e.target.initialStock.value), date);
              loadData();
              setIsAddModalOpen(false);
            }} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">物料名称 Name</label>
                <input name="name" required className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold" placeholder="请输入名称" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">计算单位 Unit</label>
                <input name="unit" required className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="如: kg, 个" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">期初实时库存 Initial Stock</label>
                <input name="initialStock" type="number" min="0" defaultValue="0" className="w-full px-4 py-4 bg-blue-50/50 border border-blue-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-2xl font-black text-blue-600" />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">取消</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200">确认添加</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
