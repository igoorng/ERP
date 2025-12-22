import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Trash2, X, Calendar as CalendarIcon, Loader2, FileUp, CheckSquare, Square, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, ShoppingCart, Warehouse } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const today = db.getBeijingDate();
  const [date, setDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMat, setNewMat] = useState({ name: '', unit: '', baseUnit: '', initialStock: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isToday = useMemo(() => date === today, [date, today]);

  // 计算当前页是否全选
  const isAllSelected = useMemo(() => {
    if (inventory.length === 0) return false;
    return inventory.every(item => selectedIds.includes(item.materialId));
  }, [inventory, selectedIds]);

  const loadData = async (forceRefresh: boolean = false, page: number = 1, search: string = '') => {
    setLoading(true);
    try {
      if (page === 1) {
        await db.initializeDate(date);
      }
      
      const [matsData, invData] = await Promise.all([
        db.getMaterialsPaginated(page, pageSize, date, search, forceRefresh),
        db.getInventoryForDatePaginated(date, page, pageSize, search, forceRefresh)
      ]);
      
      setMaterials(matsData.materials);
      setInventory(invData.inventory);
      setTotalItems(invData.total);
      setHasMore(invData.hasMore);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    const timer = setTimeout(() => {
      loadData(false, 1, searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [date, searchTerm]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (newPage > Math.ceil(totalItems / pageSize) && totalItems > 0)) return;
    loadData(false, newPage, searchTerm);
  };

  const handleInputChange = async (materialId: string, field: keyof DailyInventory, value: string) => {
    if (!isToday) return;
    const numValue = Math.max(0, parseFloat(value) || 0);
    
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
      await loadData(true, 1, searchTerm);
    } catch (err: any) {
      alert(`添加失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!isToday) return;
    if (window.confirm(`确定要移除物料 "${name}" 吗？`)) {
      setLoading(true);
      try {
        await db.deleteMaterial(id, date);
        await loadData(true, currentPage, searchTerm);
      } catch (err: any) {
        alert(`删除失败: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBatchDelete = async () => {
    if (!isToday || selectedIds.length === 0) return;
    if (window.confirm(`确定要批量移除选中的 ${selectedIds.length} 项物料吗？`)) {
      setLoading(true);
      try {
        await db.deleteMaterials(selectedIds, date);
        setSelectedIds([]);
        await loadData(true, 1, searchTerm);
      } catch (err: any) {
        alert(`批量删除失败: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
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
        let count = 0;
        for (const row of (data as any[])) {
          const name = row['物料名称'];
          const baseUnit = row['计量单位'];
          const unit = row['物料单位'];
          const stock = parseFloat(row['昨日库存'] || 0);
          
          if (name && unit && baseUnit) {
            await db.addMaterial(String(name), String(unit), String(baseUnit), stock, date);
            count++;
          }
        }
        alert(`导入成功！共新增 ${count} 项物料。`);
        await loadData(true, 1, searchTerm);
      } catch (err: any) {
        alert(`导入失败: ${err.message}`);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = inventory.map(i => i.materialId);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      const pageIds = inventory.map(i => i.materialId);
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索物料名称..."
            className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all text-sm lg:text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center bg-blue-50 px-3 py-1 rounded-xl border border-blue-100 flex-1 lg:flex-none">
             <CalendarIcon size={14} className="text-blue-500 mr-2" />
             <input
              type="date"
              max={today}
              className="bg-transparent border-none py-2 font-black text-blue-700 outline-none text-xs lg:text-sm w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {isToday && selectedIds.length > 0 && (
            <button 
              onClick={handleBatchDelete} 
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-xl font-black shadow-lg shadow-red-200 animate-in slide-in-from-right-4 transition-all active:scale-95"
            >
              <Trash2 size={18}/>
              <span className="hidden sm:inline">删除 ({selectedIds.length})</span>
            </button>
          )}
          
          <button 
            onClick={() => setIsAddModalOpen(true)} 
            disabled={!isToday} 
            className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 disabled:opacity-30 transition-all"
            title="新增物料"
          >
            <Plus size={22}/>
          </button>

          <label className={`p-3 bg-indigo-50 text-indigo-700 rounded-xl cursor-pointer hover:bg-indigo-100 active:scale-95 transition-all ${!isToday ? 'opacity-30' : ''}`} title="批量导入 Excel">
            <FileUp size={22} />
            <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={!isToday} />
          </label>

          <button onClick={() => loadData(true, currentPage, searchTerm)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-blue-600 transition-colors" title="刷新数据">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center min-h-[300px]">
             <Loader2 className="animate-spin text-blue-600" size={40} />
          </div>
        )}

        {/* 桌面端：表格布局 (lg:block) */}
        <div className="hidden lg:block bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 w-16 text-center">
                    <button onClick={toggleSelectAll} disabled={!isToday || inventory.length === 0} className="transition-transform active:scale-90">
                      {isAllSelected ? <CheckSquare className="text-blue-600" size={22} /> : <Square className="text-gray-300" size={22} />}
                    </button>
                  </th>
                  <th className="px-4 py-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">物料名称</th>
                  <th className="px-4 py-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">计量单位</th>
                  <th className="px-4 py-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">物料单位</th>
                  <th className="px-4 py-5 text-center font-black text-gray-400 text-[10px] uppercase tracking-widest">昨日库存</th>
                  <th className="px-4 py-5 text-center font-black text-blue-600 text-[10px] uppercase tracking-widest">今日入库</th>
                  <th className="px-4 py-5 text-center font-black text-orange-600 text-[10px] uppercase tracking-widest">车间出库</th>
                  <th className="px-4 py-5 text-center font-black text-purple-600 text-[10px] uppercase tracking-widest">店面出库</th>
                  <th className="px-4 py-5 text-center font-black text-gray-900 text-[10px] uppercase tracking-widest">实时库存</th>
                  <th className="px-4 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inventory.map(item => {
                  const mat = materials.find(m => m.id === item.materialId);
                  const isSelected = selectedIds.includes(item.materialId);
                  return (
                    <tr key={item.id} className={`transition-all hover:bg-gray-50/80 ${isSelected ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-6 py-5 text-center">
                        <button onClick={() => toggleSelect(item.materialId)} disabled={!isToday}>
                          {isSelected ? <CheckSquare className="text-blue-600" size={20} /> : <Square className="text-gray-300 hover:text-gray-400" size={20} />}
                        </button>
                      </td>
                      <td className="px-4 py-5 font-black text-gray-900">{mat?.name}</td>
                      <td className="px-4 py-5">
                         <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg">{mat?.baseUnit}</span>
                      </td>
                      <td className="px-4 py-5 font-bold text-gray-500">{mat?.unit}</td>
                      <td className="px-4 py-5 text-center font-mono font-bold text-gray-400">{item.openingStock}</td>
                      <td className="px-4 py-5">
                        <input type="number" disabled={!isToday} value={item.todayInbound || ''} onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)} className="w-full p-2 bg-blue-50/50 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="0" />
                      </td>
                      <td className="px-4 py-5">
                        <input type="number" disabled={!isToday} value={item.workshopOutbound || ''} onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)} className="w-full p-2 bg-orange-50/50 rounded-lg text-center font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="0" />
                      </td>
                      <td className="px-4 py-5">
                        <input type="number" disabled={!isToday} value={item.storeOutbound || ''} onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)} className="w-full p-2 bg-purple-50/50 rounded-lg text-center font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="0" />
                      </td>
                      <td className={`px-4 py-5 text-center font-black text-xl tracking-tighter ${item.remainingStock < 10 ? 'text-red-600 animate-pulse' : 'text-blue-900'}`}>
                        {item.remainingStock}
                      </td>
                      <td className="px-4 py-5">
                        {isToday && <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="text-gray-300 hover:text-red-500 transition-colors p-2"><Trash2 size={18}/></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 移动端：卡片式列表 (lg:hidden) */}
        <div className="lg:hidden space-y-3">
          {inventory.map(item => {
            const mat = materials.find(m => m.id === item.materialId);
            const isSelected = selectedIds.includes(item.materialId);
            return (
              <div key={item.id} className={`bg-white rounded-3xl p-5 border border-gray-100 shadow-sm transition-all ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => toggleSelect(item.materialId)} disabled={!isToday} className="mt-1">
                      {isSelected ? <CheckSquare className="text-blue-600" size={24} /> : <Square className="text-gray-300" size={24} />}
                    </button>
                    <div>
                      <h4 className="font-black text-gray-900 text-lg leading-tight">{mat?.name}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md uppercase">{mat?.baseUnit}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{mat?.unit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">当前库存</p>
                    <div className={`text-2xl font-black tracking-tighter ${item.remainingStock < 10 ? 'text-red-600' : 'text-blue-900'}`}>
                      {item.remainingStock}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1 text-[10px] font-black text-blue-600 uppercase tracking-tight">
                      <ArrowDownLeft size={10} />
                      <span>今日入库</span>
                    </div>
                    <input 
                      type="number" 
                      inputMode="decimal"
                      disabled={!isToday} 
                      value={item.todayInbound || ''} 
                      onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)} 
                      className="w-full py-3 px-2 bg-blue-50/50 rounded-2xl text-center font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-blue-100/50" 
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1 text-[10px] font-black text-orange-600 uppercase tracking-tight">
                      <Warehouse size={10} />
                      <span>车间出库</span>
                    </div>
                    <input 
                      type="number" 
                      inputMode="decimal"
                      disabled={!isToday} 
                      value={item.workshopOutbound || ''} 
                      onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)} 
                      className="w-full py-3 px-2 bg-orange-50/50 rounded-2xl text-center font-bold text-orange-700 outline-none focus:ring-2 focus:ring-orange-500 transition-all border border-orange-100/50" 
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1 text-[10px] font-black text-purple-600 uppercase tracking-tight">
                      <ArrowUpRight size={10} />
                      <span>店面出库</span>
                    </div>
                    <input 
                      type="number" 
                      inputMode="decimal"
                      disabled={!isToday} 
                      value={item.storeOutbound || ''} 
                      onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)} 
                      className="w-full py-3 px-2 bg-purple-50/50 rounded-2xl text-center font-bold text-purple-700 outline-none focus:ring-2 focus:ring-purple-500 transition-all border border-purple-100/50" 
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                  <div className="text-[10px] font-bold text-gray-400">
                    昨日结余: <span className="font-mono">{item.openingStock}</span>
                  </div>
                  {isToday && (
                    <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="text-red-300 hover:text-red-500 p-2 transition-colors">
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {inventory.length === 0 && !loading && (
          <div className="py-20 text-center flex flex-col items-center bg-white rounded-[2rem] border border-gray-100 mt-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="text-gray-200" size={40} />
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">
              {searchTerm ? `没有找到与 "${searchTerm}" 相关的物料` : '暂无匹配的物料记录'}
            </p>
          </div>
        )}

        {/* 分页控制 (通用) */}
        <div className="mt-6 px-6 py-5 bg-white lg:bg-gray-50/50 rounded-[2rem] lg:rounded-none border border-gray-100 lg:border-t lg:border-none flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest order-2 sm:order-1">
            共 {totalItems} 项 • 第 {currentPage} / {totalPages || 1} 页
          </div>
          <div className="flex items-center space-x-2 order-1 sm:order-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all active:scale-90"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center space-x-1">
              {[...Array(Math.min(3, totalPages))].map((_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 2) pageNum = i + 1;
                else if (currentPage >= totalPages - 1) pageNum = totalPages - 2 + i;
                else pageNum = currentPage - 1 + i;

                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-10 h-10 rounded-xl font-black text-xs lg:text-sm transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-400 hover:bg-gray-50 border border-gray-100'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasMore || loading}
              className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all active:scale-90"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight">新增物料</h3>
                <p className="text-xs text-blue-100 font-medium opacity-80 uppercase tracking-widest mt-1">Register New Item</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={24}/>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-8 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">物料核心名称</label>
                <input required value={newMat.name} onChange={e => setNewMat({...newMat, name: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none transition-all" placeholder="如：特级面粉" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">计量单位</label>
                  <input required value={newMat.baseUnit} onChange={e => setNewMat({...newMat, baseUnit: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none transition-all" placeholder="斤 / KG" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">物料单位</label>
                  <input required value={newMat.unit} onChange={e => setNewMat({...newMat, unit: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none transition-all" placeholder="袋 / 箱" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">初始库存 (昨日结余)</label>
                <input type="number" inputMode="decimal" value={newMat.initialStock} onChange={e => setNewMat({...newMat, initialStock: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none transition-all" placeholder="0" />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all mt-4">
                确认录入系统
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;