import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Trash2, X, Calendar as CalendarIcon, Loader2, FileUp, ArrowRight, CheckSquare, Square } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const today = db.getBeijingDate();
  const [date, setDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMat, setNewMat] = useState({ name: '', unit: '', baseUnit: '', initialStock: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isToday = useMemo(() => date === today, [date, today]);

  const loadData = async (forceRefresh: boolean = false, page: number = 1, search: string = '') => {
    setLoading(true);
    try {
      await db.initializeDate(date);
      
      const [matsData, invData] = await Promise.all([
        db.getMaterialsPaginated(page, pageSize, date, search, forceRefresh),
        db.getInventoryForDatePaginated(date, page, pageSize, search, forceRefresh)
      ]);
      
      const inventoryMaterialIds = new Set(invData.inventory.map(item => item.materialId));
      const currentMaterialIds = new Set(matsData.materials.map(m => m.id));
      const missingIds = Array.from(inventoryMaterialIds).filter(id => !currentMaterialIds.has(id));
      
      let allMaterials = matsData.materials;
      if (missingIds.length > 0) {
        const allMatsData = await db.getMaterialsPaginated(1, 1000, date, search, forceRefresh);
        allMaterials = allMatsData.materials;
      }
      
      setMaterials(allMaterials);
      setInventory(invData.inventory);
      setTotalItems(invData.total);
      setHasMore(invData.hasMore);
      setCurrentPage(page);
      
      if (page === 1 || search !== searchTerm) setSelectedIds([]);
      if (matsData.hasMore && !forceRefresh) preloadNextPage(page + 1, search);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const preloadNextPage = async (nextPage: number, search: string) => {
    if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
    preloadTimeoutRef.current = setTimeout(async () => {
      try {
        await Promise.all([
          db.getMaterialsPaginated(nextPage, pageSize, date, search, false),
          db.getInventoryForDatePaginated(date, nextPage, pageSize, search, false)
        ]);
      } catch (error) {}
    }, 2000);
  };

  useEffect(() => {
    setCurrentPage(1);
    loadData(false, 1, searchTerm);
  }, [date]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      loadData(false, 1, searchTerm);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleInputChange = async (materialId: string, field: keyof DailyInventory, value: string) => {
    if (!isToday) return;
    const numValue = Math.max(0, parseInt(value) || 0);
    
    const updatedInventory = inventory.map(item => {
      if (item.materialId === materialId) {
        const newItem = { ...item, [field]: numValue };
        newItem.remainingStock = newItem.openingStock + newItem.todayInbound - newItem.workshopOutbound - newItem.storeOutbound;
        return newItem;
      }
      return item;
    });
    setInventory(updatedInventory);

    const target = updatedInventory.find(i => i.materialId === materialId);
    if (target) await db.saveInventoryRecord(target);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isToday || !newMat.name || !newMat.unit) return;
    setLoading(true);
    try {
      await db.addMaterial(newMat.name, newMat.unit, newMat.baseUnit || newMat.unit, newMat.initialStock, date);
      setIsAddModalOpen(false);
      setNewMat({ name: '', unit: '', baseUnit: '', initialStock: 0 });
      await loadData(true, currentPage, searchTerm);
    } catch (e) {
      alert('添加失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!isToday) return;
    if (window.confirm(`确定要移除物料 "${name}" 吗？`)) {
      setLoading(true);
      await db.deleteMaterial(id, date);
      await loadData(true, currentPage, searchTerm);
    }
  };

  const handleBatchDelete = async () => {
    if (!isToday || selectedIds.length === 0) return;
    if (window.confirm(`确定要批量移除选中的 ${selectedIds.length} 项物料吗？`)) {
      setLoading(true);
      try {
        await db.deleteMaterials(selectedIds, date);
        setSelectedIds([]);
        await loadData(true, currentPage, searchTerm);
      } catch (e) {
        alert('批量删除失败');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === inventory.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(inventory.map(item => item.materialId));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isToday) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        setLoading(true);
        for (const row of (data as any[])) {
          const name = row['物料名称'] || row['名称'];
          const unit = row['物料单位'] || row['单位'];
          const baseUnit = row['基本计量单位'] || row['基本单位'] || unit;
          const stock = Number(row['昨日库存'] || row['期初库存'] || 0);
          if (name && unit) await db.addMaterial(String(name), String(unit), String(baseUnit), stock, date);
        }
        await loadData(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        alert('导入失败');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-24 lg:pb-0">
      <div className="bg-white p-4 rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索物料名称或单位..."
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl lg:rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center justify-between w-full lg:w-auto lg:justify-start gap-2">
          <div className="relative flex-1 lg:flex-none">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={14} />
            <input
              type="date"
              max={today}
              className="w-full pl-9 pr-2 py-3 border-none rounded-xl font-black bg-blue-50 text-blue-700 outline-none text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            {isToday && selectedIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="flex items-center space-x-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors animate-in zoom-in-95"
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">删除({selectedIds.length})</span>
              </button>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              disabled={!isToday}
              className="p-3 bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-30 hover:bg-blue-700 transition-all active:scale-95"
              title="新增物料"
            >
              <Plus size={20} />
            </button>
            
            <label className={`hidden lg:flex p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors ${!isToday ? 'opacity-30 pointer-events-none' : ''}`}>
              <FileUp size={20} />
              <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={!isToday} />
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mb-4 text-blue-500" size={48} />
          <p className="font-black text-sm uppercase tracking-widest">
            {currentPage > 1 ? `正在加载第 ${currentPage} 页...` : '数据同步中...'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden lg:block bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 w-12 text-center">
                    <button 
                      onClick={toggleSelectAll}
                      disabled={!isToday || inventory.length === 0}
                      className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-30"
                    >
                      {selectedIds.length === inventory.length && inventory.length > 0 ? (
                        <CheckSquare size={20} className="text-blue-600" />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">物料名称</th>
                  <th className="px-4 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">基本单位</th>
                  <th className="px-4 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">物料单位</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">昨日库存</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-blue-600 uppercase tracking-widest">今日入库</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-orange-600 uppercase tracking-widest">车间出库</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-purple-600 uppercase tracking-widest">店面出库</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black text-gray-900 bg-blue-50/50 uppercase tracking-widest border-l border-gray-100">实时库存</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inventory.map(item => {
                  const mat = materials.find(m => m.id === item.materialId);
                  const isSelected = selectedIds.includes(item.materialId);
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
                      <td className="px-6 py-5 text-center">
                        <button 
                          onClick={() => toggleSelect(item.materialId)}
                          disabled={!isToday}
                          className="text-gray-300 hover:text-blue-600 transition-colors"
                        >
                          {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                        </button>
                      </td>
                      <td className="px-4 py-5 font-black text-gray-900">{mat?.name || '加载中...'}</td>
                      <td className="px-4 py-5 text-center font-bold text-indigo-500">{mat?.baseUnit || '-'}</td>
                      <td className="px-4 py-5 text-center font-bold text-gray-500">{mat?.unit || '-'}</td>
                      <td className="px-6 py-5 text-center font-mono font-black text-gray-400">{item.openingStock}</td>
                      <td className="px-6 py-5 text-center">
                        <input 
                          type="number" 
                          disabled={!isToday} 
                          value={item.todayInbound || ''} 
                          placeholder="0"
                          onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)} 
                          className="w-20 px-2 py-2 bg-blue-50/50 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                        />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <input 
                          type="number" 
                          disabled={!isToday} 
                          value={item.workshopOutbound || ''} 
                          placeholder="0"
                          onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)} 
                          className="w-20 px-2 py-2 bg-orange-50/50 rounded-lg text-center font-bold focus:ring-2 focus:ring-orange-500 outline-none" 
                        />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <input 
                          type="number" 
                          disabled={!isToday} 
                          value={item.storeOutbound || ''} 
                          placeholder="0"
                          onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)} 
                          className="w-20 px-2 py-2 bg-purple-50/50 rounded-lg text-center font-bold focus:ring-2 focus:ring-purple-500 outline-none" 
                        />
                      </td>
                      <td className="px-8 py-5 text-center font-black text-blue-900 bg-blue-50/30 text-2xl border-l border-gray-100">
                        {item.remainingStock}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {isToday && (
                          <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={18}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 手机端布局 */}
          <div className="lg:hidden space-y-4">
            {inventory.map(item => {
              const mat = materials.find(m => m.id === item.materialId);
              const isSelected = selectedIds.includes(item.materialId);
              return (
                <div key={item.id} className={`bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-50' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start space-x-3">
                      {isToday && (
                        <button onClick={() => toggleSelect(item.materialId)} className="mt-1 text-gray-300 hover:text-blue-600">
                          {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                        </button>
                      )}
                      <div>
                        <h4 className="font-black text-gray-900 leading-tight">{mat?.name || '...'}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">单位: {mat?.unit || '-'}</span>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">基本单位: {mat?.baseUnit || '-'}</span>
                          <span className="text-[10px] font-black text-gray-400">昨存: {item.openingStock}</span>
                        </div>
                      </div>
                    </div>
                    {isToday && (
                      <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="p-2 text-red-200 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-blue-400 uppercase text-center block">入库</label>
                      <input type="number" disabled={!isToday} value={item.todayInbound || ''} placeholder="0" onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)} className="w-full py-3 bg-blue-50/30 rounded-xl text-center font-black text-blue-700 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-orange-400 uppercase text-center block">车间</label>
                      <input type="number" disabled={!isToday} value={item.workshopOutbound || ''} placeholder="0" onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)} className="w-full py-3 bg-orange-50/30 rounded-xl text-center font-black text-orange-700 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-purple-400 uppercase text-center block">店面</label>
                      <input type="number" disabled={!isToday} value={item.storeOutbound || ''} placeholder="0" onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)} className="w-full py-3 bg-purple-50/30 rounded-xl text-center font-black text-purple-700 outline-none" />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">实时库存:</span>
                    <span className="text-2xl font-black text-blue-900 tracking-tighter">{item.remainingStock}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {totalItems > pageSize && (
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <span className="hidden sm:block text-xs font-bold text-gray-400">第 {currentPage} 页 / 共 {Math.ceil(totalItems / pageSize)} 页</span>
              <div className="flex space-x-2 w-full sm:w-auto">
                <button
                  onClick={() => loadData(false, currentPage - 1, searchTerm)}
                  disabled={currentPage === 1}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 rounded-xl font-bold text-sm disabled:opacity-30"
                >
                  上一页
                </button>
                <button
                  onClick={() => loadData(false, currentPage + 1, searchTerm)}
                  disabled={!hasMore}
                  className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-30"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] lg:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-black text-lg">新增物料资产</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/20 rounded-lg"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">物料名称</label>
                <input required value={newMat.name} onChange={e => setNewMat({...newMat, name: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：面粉、芝麻..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">物料单位</label>
                  <input required value={newMat.unit} onChange={e => setNewMat({...newMat, unit: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="kg/袋" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">基本单位</label>
                  <input required value={newMat.baseUnit} onChange={e => setNewMat({...newMat, baseUnit: e.target.value})} className="w-full px-5 py-4 bg-indigo-50/50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="标准计量单位" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">期初库存</label>
                <input type="number" required value={newMat.initialStock} onChange={e => setNewMat({...newMat, initialStock: parseInt(e.target.value) || 0})} className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95">确认入库</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;