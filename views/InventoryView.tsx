
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { config } from '../services/config';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Upload, Trash2, X, CheckSquare, Square, Calculator, Calendar as CalendarIcon, Lock, Loader2 } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const [date, setDate] = useState(db.getBeijingDate());
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isToday = useMemo(() => date === db.getBeijingDate(), [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. 调用后端初始化接口
      await db.initializeDate(date);
      // 2. 并行获取物料和库存数据
      const [mats, inv] = await Promise.all([
        db.getMaterials(date),
        db.getInventoryForDate(date)
      ]);
      setMaterials(mats);
      setInventory(inv);
      setSelectedIds(new Set());
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
      db.logAction('UPDATE', `更新物料 ID ${materialId} 的 ${field} 为 ${numValue}`);
    }
  };

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!isToday) return;
    if (window.confirm(`确定要删除物料 "${name}" 吗？`)) {
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
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        setLoading(true);
        for (const row of data as any[]) {
          const name = row['物料名称'] || row['名称'];
          const unit = row['物料单位'] || row['单位'];
          const stock = Number(row['昨日库存'] || 0);
          if (name && unit) {
            await db.addMaterial(name, unit, stock, date);
          }
        }
        await loadData();
        alert('导入成功');
      } catch (err) {
        alert('导入失败');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜物料名称..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="date"
            className="px-4 py-3 border rounded-xl font-bold bg-blue-50 text-blue-700 outline-none"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!isToday}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p className="font-bold">正在同步云端数据库...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">物料名称</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">昨日库存</th>
                <th className="px-6 py-4 text-xs font-bold text-blue-600 uppercase text-center">今日入库</th>
                <th className="px-6 py-4 text-xs font-bold text-orange-600 uppercase text-center">车间出库</th>
                <th className="px-6 py-4 text-xs font-bold text-purple-600 uppercase text-center">店面出库</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-900 uppercase bg-blue-50/50 text-center">今日剩余</th>
                <th className="px-6 py-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredData.map(item => {
                const mat = materials.find(m => m.id === item.materialId);
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{mat?.name}</div>
                      <div className="text-[10px] text-gray-400 font-bold">单位: {mat?.unit}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-gray-500">{item.openingStock}</td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.todayInbound}
                        onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                        className="w-20 px-2 py-1 border rounded text-center font-bold"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.workshopOutbound}
                        onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                        className="w-20 px-2 py-1 border rounded text-center font-bold"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        disabled={!isToday}
                        value={item.storeOutbound}
                        onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                        className="w-20 px-2 py-1 border rounded text-center font-bold"
                      />
                    </td>
                    <td className="px-6 py-4 text-center font-black text-blue-800 bg-blue-50/30 text-lg">
                      {item.remainingStock}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isToday && (
                        <button onClick={() => handleDeleteMaterial(item.materialId, mat?.name || '')} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal 逻辑保持不变，但提交函数改为异步即可 */}
    </div>
  );
};

export default InventoryView;
