import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Trash2, X, Calendar as CalendarIcon, Loader2, FileUp, ArrowRight, CheckSquare, Square, AlertCircle } from 'lucide-react';

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
    setCurrentPage(1);
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
      await loadData(true);
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
        await loadData(true);
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
        await loadData(true);
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
          // 精确匹配用户要求的表头
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
        await loadData(true);
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

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索物料..."
            className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl font-bold outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <input
            type="date"
            max={today}
            className="flex-1 lg:w-40 px-4 py-3 border-none rounded-xl font-black bg-blue-50 text-blue-700"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {isToday && selectedIds.length > 0 && (
            <button onClick={handleBatchDelete} className="p-3 bg-red-50 text-red-600 rounded-xl font-bold"><Trash2 size={20}/></button>
          )}
          <button onClick={() => setIsAddModalOpen(true)} disabled={!isToday} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-30"><Plus size={20}/></button>
          <label className={`p-3 bg-indigo-50 text-indigo-700 rounded-xl cursor-pointer ${!isToday ? 'opacity-30' : ''}`}>
            <FileUp size={20} />
            <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={!isToday} />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mb-4 text-blue-500" size={48} />
          <p className="font-black text-sm uppercase">数据加载中...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 w-12 text-center">选择</th>
                  <th className="px-4 py-5 font-black text-gray-400 text-[10px] uppercase">物料名称</th>
                  <th className="px-4 py-5 font-black text-gray-400 text-[10px] uppercase">计量单位</th>
                  <th className="px-4 py-5 font-black text-gray-400 text-[10px] uppercase">物料单位</th>
                  <th className="px-4 py-5 text-center font-black text-gray-400 text-[10px] uppercase">昨日库存</th>
                  <th className="px-4 py-5 text-center font-black text-blue-600 text-[10px] uppercase">今日入库</th>
                  <th className="px-4 py-5 text-center font-black text-orange-600 text-[10px] uppercase">车间出库</th>
                  <th className="px-4 py-5 text-center font-black text-purple-600 text-[10px] uppercase">店面出库</th>
                  <th className="px-4 py-5 text-center font-black text-gray-900 text-[10px] uppercase">实时库存</th>
                  <th className="px-4 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inventory.map(item => {
                  const mat = materials.find(m => m.id === item.materialId);
                  const isSelected = selectedIds.includes(item.materialId);
                  return (
                    <tr key={item.id} className={isSelected ? 'bg-blue-50/30' : ''}>
                      <td className="px-6 py-5 text-center">
                        <button onClick={() => toggleSelect(item.materialId)} disabled={!isToday}>
                          {isSelected ? <CheckSquare className="text-blue-600" /> : <Square className="text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-4 py-5 font-black text-gray-900">{mat?.name}</td>
                      <td className="px-4 py-5 font-bold text-indigo-500">{mat?.baseUnit}</td>
                      <td className="px-4 py-5 font-bold text-gray-500">{mat?.unit}</td>
                      <td className="px-4 py-5 text-center font-mono font-bold text-gray-400">{item.openingStock}</td>
                      <td className="px-4 py-5">
                        <input type="number" disabled={!isToday} value={item.todayInbound || ''} onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)} className="w-full p-2 bg-blue-50/50 rounded-lg text-center font-bold" />
                      </td>
                      <td className="px-4 py-5">
                        <input type="number" disabled={!isToday} value={item.workshopOutbound || ''} onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)} className="w-full p-2 bg-orange-50/50 rounded-lg text-center font-bold" />
                      </td>
                      <td className="px-4 py-5">
                        <input type="number" disabled={!isToday} value={item.storeOutbound || ''} onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)} className="w-full p-2 bg-purple-50/50 rounded-lg text-center font-bold" />
                      </td>
                      <td className="px-4 py-5 text-center font-black text-blue-900 text-xl">{item.remainingStock}</td>
                      <td className="px-4 py-5">
                        {isToday && <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="text-gray-300 hover:text-red-500"><Trash2 size={18}/></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-black">新增物料</h3>
              <button onClick={() => setIsAddModalOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-8 space-y-4">
              <input required value={newMat.name} onChange={e => setNewMat({...newMat, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="物料名称" />
              <input required value={newMat.baseUnit} onChange={e => setNewMat({...newMat, baseUnit: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="计量单位 (如: 斤, 公斤)" />
              <input required value={newMat.unit} onChange={e => setNewMat({...newMat, unit: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="物料单位 (如: 袋, 箱)" />
              <input type="number" value={newMat.initialStock} onChange={e => setNewMat({...newMat, initialStock: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" placeholder="昨日库存" />
              <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl">保存物料</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;