import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Trash2, X, Calendar as CalendarIcon, Loader2, FileUp, ArrowRight, CheckSquare, Square, PackageCheck } from 'lucide-react';

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
  const [newMat, setNewMat] = useState({ name: '', unit: '', initialStock: 0 });
  
  const isToday = useMemo(() => date === today, [date, today]);

  const loadData = async (forceRefresh: boolean = false, page: number = 1, search: string = '') => {
    setLoading(true);
    try {
      await db.initializeDate(date);
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
    loadData(false, 1, searchTerm);
  }, [date, searchTerm]);

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
      await loadData(true, 1, searchTerm);
    } catch (e) {
      alert('添加失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-0">
      {/* 头部导航/搜索 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
            <PackageCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">实时库存管理</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Material & Inventory Records</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="快速搜物料..."
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={14} />
            <input
              type="date"
              max={today}
              className="pl-9 pr-3 py-3 border-none rounded-2xl font-black bg-blue-50 text-blue-700 outline-none text-xs"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!isToday}
            className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100 disabled:opacity-30 hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
          <p className="font-black text-xs uppercase tracking-widest">数据同步中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">物料名称</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">单位</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">昨日库存</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-blue-600 uppercase tracking-widest">今日入库</th>
                <th className="px-6 py-5 text-center text-[10px] font-black text-orange-600 uppercase tracking-widest">出库合计</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-white bg-slate-900 uppercase tracking-widest">实时库存</th>
                {isToday && <th className="px-6 py-5 w-16"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inventory.map(item => {
                const mat = materials.find(m => m.id === item.materialId);
                const totalOut = (item.workshopOutbound || 0) + (item.storeOutbound || 0);
                
                return (
                  <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-900 text-base">{mat?.name || '未知物料'}</div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black">{mat?.unit}</span>
                    </td>
                    <td className="px-6 py-6 text-center font-mono font-bold text-gray-400">{item.openingStock}</td>
                    <td className="px-6 py-6 text-center">
                      <input 
                        type="number" 
                        disabled={!isToday} 
                        value={item.todayInbound || ''} 
                        placeholder="0"
                        onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)} 
                        className="w-20 px-2 py-2 bg-blue-50 border border-blue-100 rounded-xl text-center font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        <input 
                          type="number" 
                          disabled={!isToday} 
                          value={item.workshopOutbound || ''} 
                          placeholder="生产"
                          onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)} 
                          className="w-20 px-2 py-1.5 bg-orange-50 border border-orange-100 rounded-lg text-center font-bold text-orange-700 text-xs" 
                        />
                        <input 
                          type="number" 
                          disabled={!isToday} 
                          value={item.storeOutbound || ''} 
                          placeholder="销售"
                          onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)} 
                          className="w-20 px-2 py-1.5 bg-purple-50 border border-purple-100 rounded-lg text-center font-bold text-purple-700 text-xs" 
                        />
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center bg-slate-50">
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{item.remainingStock}</span>
                        <div className="w-8 h-1 bg-blue-600 rounded-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                    </td>
                    {isToday && (
                      <td className="px-6 py-6 text-center">
                        <button onClick={() => db.deleteMaterial(item.materialId, date).then(() => loadData(true))} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {inventory.length === 0 && (
            <div className="py-20 text-center text-gray-300">
               <PackageCheck size={48} className="mx-auto mb-4 opacity-20" />
               <p className="font-black text-xs uppercase tracking-widest">暂无物料数据</p>
            </div>
          )}
        </div>
      )}

      {/* 分页 */}
      {totalItems > pageSize && (
        <div className="flex items-center justify-center space-x-2">
          <button 
            disabled={currentPage === 1} 
            onClick={() => loadData(false, currentPage - 1, searchTerm)}
            className="px-6 py-3 bg-white border border-gray-100 rounded-2xl font-black text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            上一页
          </button>
          <span className="px-4 py-2 font-black text-blue-600">{currentPage} / {Math.ceil(totalItems / pageSize)}</span>
          <button 
            disabled={!hasMore} 
            onClick={() => loadData(false, currentPage + 1, searchTerm)}
            className="px-6 py-3 bg-white border border-gray-100 rounded-2xl font-black text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            下一页
          </button>
        </div>
      )}

      {/* 新增物料弹窗 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-black">新增物料记录</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">物料名称</label>
                <input required value={newMat.name} onChange={e => setNewMat({...newMat, name: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：面粉、芝麻..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">单位</label>
                  <input required value={newMat.unit} onChange={e => setNewMat({...newMat, unit: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="kg / 袋" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">期初库存</label>
                  <input type="number" required value={newMat.initialStock} onChange={e => setNewMat({...newMat, initialStock: parseFloat(e.target.value) || 0})} className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">
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
