
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Trash2, X, Calculator, Calendar as CalendarIcon, Loader2, FileUp, Save, Lock, ArrowRight } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const today = db.getBeijingDate();
  const [date, setDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMat, setNewMat] = useState({ name: '', unit: '', initialStock: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isToday = useMemo(() => date === today, [date, today]);

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
      await loadData();
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
        for (const row of (data as any[])) {
          const name = row['物料名称'] || row['名称'];
          const unit = row['物料单位'] || row['单位'];
          const stock = Number(row['昨日库存'] || row['期初库存'] || 0);
          if (name && unit) await db.addMaterial(String(name), String(unit), stock, date);
        }
        await loadData();
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
      {/* 顶部工具栏 - 手机端垂直排列 */}
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
        
        <div className="flex items-center space-x-2 w-full lg:w-auto">
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
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!isToday}
            className="p-3 bg-blue-600 text-white rounded-xl shadow-lg disabled:opacity-30"
          >
            <Plus size={20} />
          </button>
          <label className={`p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 ${!isToday ? 'opacity-30' : ''}`}>
            <FileUp size={20} />
            <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={!isToday} />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p className="font-black text-sm uppercase">同步中...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 桌面端表格显示 */}
          <div className="hidden lg:block bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">物料详情</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400">昨日库存</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-blue-600">今日入库</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-orange-600">车间出库</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-purple-600">店面出库</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black text-gray-900 bg-blue-50/30">当前结存</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.map(item => {
                  const mat = materials.find(m => m.id === item.materialId);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-8 py-5">
                        <div className="font-black text-gray-900">{mat?.name}</div>
                        <div className="text-[10px] text-gray-400 uppercase">单位: {mat?.unit}</div>
                      </td>
                      <td className="px-6 py-5 text-center font-mono font-black text-gray-400">{item.openingStock}</td>
                      <td className="px-6 py-5 text-center">
                        <input type="number" disabled={!isToday} value={item.todayInbound} onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)} className="w-20 px-2 py-2 bg-blue-50/50 rounded-lg text-center font-bold" />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <input type="number" disabled={!isToday} value={item.workshopOutbound} onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)} className="w-20 px-2 py-2 bg-orange-50/50 rounded-lg text-center font-bold" />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <input type="number" disabled={!isToday} value={item.storeOutbound} onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)} className="w-20 px-2 py-2 bg-purple-50/50 rounded-lg text-center font-bold" />
                      </td>
                      <td className="px-8 py-5 text-center font-black text-blue-900 bg-blue-50/20 text-xl">{item.remainingStock}</td>
                      <td className="px-6 py-5">
                        {isToday && <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="text-gray-300 hover:text-red-500"><Trash2 size={18}/></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 手机端卡片列表 */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {filteredData.map(item => {
              const mat = materials.find(m => m.id === item.materialId);
              return (
                <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-gray-900 leading-tight">{mat?.name}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">单位: {mat?.unit}</span>
                        <span className="text-[10px] font-black text-gray-400">期初: {item.openingStock}</span>
                      </div>
                    </div>
                    {isToday && (
                      <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="p-2 text-red-200">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-blue-400 uppercase block ml-1 text-center">入库</label>
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.todayInbound}
                        onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                        className="w-full py-3 bg-blue-50/50 rounded-xl text-center font-black text-blue-700 border-none outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-orange-400 uppercase block ml-1 text-center">车间</label>
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.workshopOutbound}
                        onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                        className="w-full py-3 bg-orange-50/50 rounded-xl text-center font-black text-orange-700 border-none outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-purple-400 uppercase block ml-1 text-center">店面</label>
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.storeOutbound}
                        onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                        className="w-full py-3 bg-purple-50/50 rounded-xl text-center font-black text-purple-700 border-none outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">实时计算剩余库存:</span>
                    <div className="flex items-center space-x-2">
                      <ArrowRight size={14} className="text-gray-300" />
                      <span className="text-2xl font-black text-blue-900 tracking-tighter">{item.remainingStock}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 新增物料弹窗 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] lg:rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-black">新增物料</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-white/10 rounded-lg"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <input required value={newMat.name} onChange={e => setNewMat({...newMat, name: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-xl font-bold" placeholder="物料名称" />
              <div className="grid grid-cols-2 gap-4">
                <input required value={newMat.unit} onChange={e => setNewMat({...newMat, unit: e.target.value})} className="w-full px-5 py-4 bg-gray-50 rounded-xl font-bold" placeholder="单位(kg/袋)" />
                <input type="number" required value={newMat.initialStock} onChange={e => setNewMat({...newMat, initialStock: parseInt(e.target.value) || 0})} className="w-full px-5 py-4 bg-gray-50 rounded-xl font-bold" placeholder="期初库存" />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg">确认添加</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
