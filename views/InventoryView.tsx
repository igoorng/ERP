
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Upload, Trash2, X, Calculator, Calendar as CalendarIcon, Loader2, FileUp, Save } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const [date, setDate] = useState(db.getBeijingDate());
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal 状态
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMat, setNewMat] = useState({ name: '', unit: '', initialStock: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isToday = useMemo(() => date === db.getBeijingDate(), [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      await db.initializeDate(date);
      const [mats, inv] = await Promise.all([
        db.getMaterials(date),
        db.getInventoryForDate(date)
      ]);
      setMaterials(mats);
      setInventory(inv);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
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

  const handleInputChange = async (materialId: string, field: keyof DailyInventory, value: string) => {
    if (!isToday) return;
    const numValue = Math.max(0, parseInt(value) || 0);
    
    // 乐观更新 UI
    const updatedInventory = inventory.map(item => {
      if (item.materialId === materialId) {
        const newItem = { ...item, [field]: numValue };
        newItem.remainingStock = newItem.openingStock + newItem.todayInbound - newItem.workshopOutbound - newItem.storeOutbound;
        return newItem;
      }
      return item;
    });
    setInventory(updatedInventory);

    // 同步到后端
    const target = updatedInventory.find(i => i.materialId === materialId);
    if (target) {
      await db.saveInventoryRecord(target);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMat.name || !newMat.unit) return;
    setLoading(true);
    try {
      await db.addMaterial(newMat.name, newMat.unit, newMat.initialStock, date);
      setIsAddModalOpen(false);
      setNewMat({ name: '', unit: '', initialStock: 0 });
      await loadData();
    } catch (e) {
      alert('添加失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!isToday) return;
    if (window.confirm(`确定要删除物料 "${name}" 吗？此操作不可逆。`)) {
      setLoading(true);
      await db.deleteMaterial(id, date);
      await loadData();
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
        let successCount = 0;
        for (const row of data as any[]) {
          const name = row['物料名称'] || row['名称'] || row['Material Name'];
          const unit = row['物料单位'] || row['单位'] || row['Unit'];
          const stock = Number(row['昨日库存'] || row['期初库存'] || row['Initial Stock'] || 0);
          
          if (name && unit) {
            await db.addMaterial(String(name), String(unit), stock, date);
            successCount++;
          }
        }
        await loadData();
        alert(`导入成功！共新增 ${successCount} 项物料。`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        alert('导入解析失败，请检查 Excel 格式');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* 顶部工具栏 */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索物料名称 (模糊查询)..."
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-3 w-full lg:w-auto">
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
            <input
              type="date"
              className="pl-10 pr-4 py-3 border-none rounded-2xl font-black bg-blue-50 text-blue-700 outline-none cursor-pointer"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!isToday}
            className="flex-1 lg:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">新增物料</span>
          </button>

          <label className={`
            cursor-pointer px-4 py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-black border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center space-x-2
            ${!isToday ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
          `}>
            <FileUp size={20} />
            <span className="hidden sm:inline">批量导入</span>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept=".xlsx,.xls" 
              onChange={handleFileUpload} 
              disabled={!isToday}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p className="font-black">正在同步实时库存数据...</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">物料详情 Material</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">昨日库存</th>
                  <th className="px-6 py-5 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">今日入库</th>
                  <th className="px-6 py-5 text-[10px] font-black text-orange-600 uppercase tracking-widest text-center">车间出库</th>
                  <th className="px-6 py-5 text-[10px] font-black text-purple-600 uppercase tracking-widest text-center">店面出库</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-900 uppercase bg-blue-50/30 tracking-widest text-center">今日剩余库存</th>
                  <th className="px-6 py-5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center opacity-30">
                      <Calculator size={48} className="mx-auto mb-4" />
                      <p className="font-black">暂无物料记录，请手动添加或导入</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map(item => {
                    const mat = materials.find(m => m.id === item.materialId);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="font-black text-gray-900 text-base">{mat?.name}</div>
                          <div className="inline-flex items-center mt-1 px-2 py-0.5 bg-gray-100 rounded-md text-[10px] font-bold text-gray-500">
                            单位: {mat?.unit}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center font-mono font-black text-gray-400 text-lg">{item.openingStock}</td>
                        <td className="px-6 py-5 text-center">
                          <input
                            type="number"
                            disabled={!isToday}
                            value={item.todayInbound}
                            onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                            className="w-24 px-3 py-2 bg-blue-50/50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl text-center font-black text-blue-700 transition-all outline-none"
                          />
                        </td>
                        <td className="px-6 py-5 text-center">
                          <input
                            type="number"
                            disabled={!isToday}
                            value={item.workshopOutbound}
                            onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                            className="w-24 px-3 py-2 bg-orange-50/50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-xl text-center font-black text-orange-700 transition-all outline-none"
                          />
                        </td>
                        <td className="px-6 py-5 text-center">
                          <input
                            type="number"
                            disabled={!isToday}
                            value={item.storeOutbound}
                            onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                            className="w-24 px-3 py-2 bg-purple-50/50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-xl text-center font-black text-purple-700 transition-all outline-none"
                          />
                        </td>
                        <td className="px-8 py-5 text-center font-black text-blue-900 bg-blue-50/20 text-2xl group-hover:bg-blue-50/40 transition-colors">
                          {item.remainingStock}
                        </td>
                        <td className="px-6 py-5 text-center">
                          {isToday && (
                            <button 
                              onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} 
                              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 新增物料弹窗 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Plus size={24} />
                <h3 className="text-xl font-black">新增库存条目</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">物料完整名称</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newMat.name}
                  onChange={e => setNewMat({...newMat, name: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none font-bold"
                  placeholder="例如: 优质面粉 (25kg)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">计量单位</label>
                  <input
                    type="text"
                    required
                    value={newMat.unit}
                    onChange={e => setNewMat({...newMat, unit: e.target.value})}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none font-bold"
                    placeholder="kg/袋/件"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">昨日/期初库存</label>
                  <input
                    type="number"
                    required
                    value={newMat.initialStock}
                    onChange={e => setNewMat({...newMat, initialStock: parseInt(e.target.value) || 0})}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none font-bold"
                  />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all mt-4 flex items-center justify-center space-x-2">
                <Save size={20} />
                <span>确认并添加</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
