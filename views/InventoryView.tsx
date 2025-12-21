
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
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50); // 每页显示50条
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMat, setNewMat] = useState({ name: '', unit: '', initialStock: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 预加载下一页的引用
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isToday = useMemo(() => date === today, [date, today]);

  const loadData = async (forceRefresh: boolean = false, page: number = 1, search: string = '') => {
    setLoading(true);
    try {
      await db.initializeDate(date);
      
      // 使用分页接口
      const [matsData, invData] = await Promise.all([
        db.getMaterialsPaginated(page, pageSize, date, search, forceRefresh),
        db.getInventoryForDatePaginated(date, page, pageSize, search, forceRefresh)
      ]);
      
      setMaterials(matsData.materials);
      setInventory(invData.inventory);
      setTotalItems(matsData.total);
      setHasMore(matsData.hasMore);
      setCurrentPage(page);
      
      // 清空选择（如果是新页面或搜索）
      if (page === 1 || search !== searchTerm) {
        setSelectedIds([]);
      }
      
      // 预加载下一页（如果还有更多数据）
      if (matsData.hasMore && !forceRefresh) {
        preloadNextPage(page + 1, search);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  // 预加载下一页数据
  const preloadNextPage = async (nextPage: number, search: string) => {
    // 清除之前的预加载定时器
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    
    // 延迟2秒后预加载，避免频繁请求
    preloadTimeoutRef.current = setTimeout(async () => {
      try {
        await Promise.all([
          db.getMaterialsPaginated(nextPage, pageSize, date, search, false),
          db.getInventoryForDatePaginated(date, nextPage, pageSize, search, false)
        ]);
        console.log(`预加载第${nextPage}页数据完成`);
      } catch (error) {
        console.log("预加载失败:", error);
      }
    }, 2000);
  };

  useEffect(() => {
    setCurrentPage(1); // 切换日期时重置到第一页
    loadData(false, 1, searchTerm);
  }, [date]);

  // 搜索防抖
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // 搜索时重置到第一页
      loadData(false, 1, searchTerm);
    }, 300); // 300ms防抖

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // 清理预加载定时器
  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  // 移除客户端过滤，因为现在在服务器端过滤
  const filteredData = useMemo(() => {
    return inventory;
  }, [inventory]);

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
    if (target) {
      await db.saveInventoryRecord(target);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isToday || !newMat.name || !newMat.unit) return;
    setLoading(true);
    try {
      await db.addMaterial(newMat.name, newMat.unit, newMat.initialStock, date);
      setIsAddModalOpen(false);
      setNewMat({ name: '', unit: '', initialStock: 0 });
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
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => item.materialId));
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
          const stock = Number(row['昨日库存'] || row['昨日库存'] || 0);
          if (name && unit) await db.addMaterial(String(name), String(unit), stock, date);
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
      {/* 顶部工具栏 */}
      <div className="bg-white p-4 rounded-2xl lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜物料..."
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl lg:rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center justify-between w-full lg:w-auto lg:justify-start">
          <div className="relative flex-1 lg:flex-none lg:mr-2">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={14} />
            <input
              type="date"
              max={today}
              className="w-full pl-9 pr-2 py-3 border-none rounded-xl font-black bg-blue-50 text-blue-700 outline-none text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2 ml-5">
            {/* 批量删除按钮 - 仅在有选中项且为今天时显示 */}
            {isToday && selectedIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="flex items-center space-x-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors animate-in zoom-in-95 duration-200"
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">删除所选 ({selectedIds.length})</span>
              </button>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              disabled={!isToday}
              className="p-3 bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-30 hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
            </button>
            
            {/* Excel导入按钮 - 仅在桌面版显示 */}
            <label className={`hidden lg:flex p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors ${!isToday ? 'opacity-30 pointer-events-none' : ''}`}>
              <FileUp size={20} />
              <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={!isToday} />
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p className="font-black text-sm uppercase">
            {currentPage > 1 ? `加载第 ${currentPage} 页...` : '同步中...'}
          </p>
          {totalItems > 0 && (
            <p className="text-xs mt-2 text-gray-400">
              共 {totalItems} 条记录，每页显示 {pageSize} 条
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* 桌面端表格显示 */}
          <div className="hidden lg:block bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-50">
                <tr>
                  <th className="px-6 py-5 w-12">
                    <button 
                      onClick={toggleSelectAll}
                      disabled={!isToday || filteredData.length === 0}
                      className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-30"
                    >
                      {selectedIds.length === filteredData.length && filteredData.length > 0 ? (
                        <CheckSquare size={20} className="text-blue-600" />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">物料详情</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400">昨日库存</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-blue-600">今日入库</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-orange-600">车间出库</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-purple-600">店面出库</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black text-gray-900 bg-blue-50/30">库存剩余</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.map(item => {
                  const mat = materials.find(m => m.id === item.materialId);
                  const isSelected = selectedIds.includes(item.materialId);
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-6 py-5">
                        <button 
                          onClick={() => toggleSelect(item.materialId)}
                          disabled={!isToday}
                          className="text-gray-300 hover:text-blue-600 transition-colors disabled:opacity-30"
                        >
                          {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                        </button>
                      </td>
                      <td className="px-4 py-5">
                        <div className="font-black text-gray-900">{mat?.name}</div>
                        <div className="text-[10px] text-gray-400 uppercase">单位: {mat?.unit}</div>
                      </td>
                      <td className="px-6 py-5 text-center font-mono font-black text-gray-400">{item.openingStock}</td>
                      <td className="px-6 py-5 text-center">
                        <input 
                          type="number" 
                          disabled={!isToday} 
                          value={item.todayInbound || ''} 
                          placeholder="0"
                          onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)} 
                          className="w-20 px-2 py-2 bg-blue-50/50 rounded-lg text-center font-bold" 
                        />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <input 
                          type="number" 
                          disabled={!isToday} 
                          value={item.workshopOutbound || ''} 
                          placeholder="0"
                          onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)} 
                          className="w-20 px-2 py-2 bg-orange-50/50 rounded-lg text-center font-bold" 
                        />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <input 
                          type="number" 
                          disabled={!isToday} 
                          value={item.storeOutbound || ''} 
                          placeholder="0"
                          onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)} 
                          className="w-20 px-2 py-2 bg-purple-50/50 rounded-lg text-center font-bold" 
                        />
                      </td>
                      <td className="px-8 py-5 text-center font-black text-blue-900 bg-blue-50/20 text-xl">{item.remainingStock}</td>
                      <td className="px-6 py-5">
                        {isToday && <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页控件 - 桌面端 */}
          {totalItems > pageSize && (
            <div className="hidden lg:flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="text-sm text-gray-500">
                显示第 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalItems)} 条，共 {totalItems} 条记录
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => loadData(false, currentPage - 1, searchTerm)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                >
                  上一页
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, Math.ceil(totalItems / pageSize)) }, (_, i) => {
                    const pageNum = i + 1;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => loadData(false, pageNum, searchTerm)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {Math.ceil(totalItems / pageSize) > 5 && (
                    <>
                      <span className="text-gray-400">...</span>
                      <button
                        onClick={() => loadData(false, Math.ceil(totalItems / pageSize), searchTerm)}
                        className="w-10 h-10 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        {Math.ceil(totalItems / pageSize)}
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => loadData(false, currentPage + 1, searchTerm)}
                  disabled={!hasMore}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          )}

          {/* 手机端卡片列表 */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {filteredData.length > 0 && isToday && (
              <div className="flex items-center justify-between px-2">
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center space-x-2 text-xs font-black text-gray-400 uppercase tracking-widest"
                >
                  {selectedIds.length === filteredData.length ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                  <span>全选本页 ({selectedIds.length}/{filteredData.length})</span>
                </button>
              </div>
            )}
            
            {filteredData.map(item => {
              const mat = materials.find(m => m.id === item.materialId);
              const isSelected = selectedIds.includes(item.materialId);
              return (
                <div key={item.id} className={`bg-white p-5 rounded-2xl shadow-sm border transition-all space-y-4 ${isSelected ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      {isToday && (
                        <button 
                          onClick={() => toggleSelect(item.materialId)}
                          className="mt-1 text-gray-300 hover:text-blue-600"
                        >
                          {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                        </button>
                      )}
                      <div>
                        <h4 className="font-black text-gray-900 leading-tight">{mat?.name}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">单位: {mat?.unit}</span>
                          <span className="text-[10px] font-black text-gray-400">昨日库存: {item.openingStock}</span>
                        </div>
                      </div>
                    </div>
                    {isToday && (
                      <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="p-2 text-red-200 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-blue-400 uppercase block ml-1 text-center">今日入库</label>
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.todayInbound || ''}
                        placeholder="0"
                        onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                        className="w-full py-3 bg-blue-50/50 rounded-xl text-center font-black text-blue-700 border-none outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-orange-400 uppercase block ml-1 text-center">车间出库</label>
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.workshopOutbound || ''}
                        placeholder="0"
                        onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                        className="w-full py-3 bg-orange-50/50 rounded-xl text-center font-black text-orange-700 border-none outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-purple-400 uppercase block ml-1 text-center">店面出库</label>
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.storeOutbound || ''}
                        placeholder="0"
                        onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                        className="w-full py-3 bg-purple-50/50 rounded-xl text-center font-black text-purple-700 border-none outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">实时计算剩余库存:</span>
                    <div className="flex items-center space-x-2 ml-5">
                      <ArrowRight size={14} className="text-gray-300" />
                      <span className="text-2xl font-black text-blue-900 tracking-tighter">{item.remainingStock}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 分页控件 - 移动端 */}
          {totalItems > pageSize && (
            <div className="lg:hidden bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="text-center text-sm text-gray-500">
                显示第 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalItems)} 条，共 {totalItems} 条
              </div>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() => loadData(false, currentPage - 1, searchTerm)}
                  disabled={currentPage === 1}
                  className="flex-1 max-w-24 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                >
                  上一页
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(3, Math.ceil(totalItems / pageSize)) }, (_, i) => {
                    const pageNum = i + 1;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => loadData(false, pageNum, searchTerm)}
                        className={`w-12 h-12 rounded-xl font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {Math.ceil(totalItems / pageSize) > 3 && (
                    <>
                      <span className="text-gray-400 self-center">...</span>
                      <button
                        onClick={() => loadData(false, Math.ceil(totalItems / pageSize), searchTerm)}
                        className="w-12 h-12 rounded-xl font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        {Math.ceil(totalItems / pageSize)}
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => loadData(false, currentPage + 1, searchTerm)}
                  disabled={!hasMore}
                  className="flex-1 max-w-24 py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 新增物料弹窗 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] lg:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-black">新增物料</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <input required value={newMat.name} onChange={e => setNewMat({...newMat, name: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="物料名称" />
              <div className="grid grid-cols-2 gap-4">
                <input required value={newMat.unit} onChange={e => setNewMat({...newMat, unit: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="单位(kg/袋)" />
                <input type="number" required value={newMat.initialStock} onChange={e => setNewMat({...newMat, initialStock: parseInt(e.target.value) || 0})} className="w-full px-5 py-4 bg-gray-50 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="期初库存" />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 transition-colors">确认添加</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
