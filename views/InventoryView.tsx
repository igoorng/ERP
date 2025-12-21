
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { config } from '../services/config';
import { Material, DailyInventory } from '../types';
import { Plus, Search, Upload, Trash2, X, CheckSquare, Square, Calculator, Calendar as CalendarIcon, Lock } from 'lucide-react';

declare const XLSX: any;

const InventoryView: React.FC = () => {
  const [date, setDate] = useState(db.getBeijingDate());
  const [searchTerm, setSearchTerm] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventory, setInventory] = useState<DailyInventory[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isToday = useMemo(() => date === db.getBeijingDate(), [date]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentBeijingDate = db.getBeijingDate();
      if (date !== currentBeijingDate && isToday) {
        setDate(currentBeijingDate);
      }
    }, 10000); 

    return () => clearInterval(interval);
  }, [date, isToday]);

  const loadData = () => {
    // 1. 初始化库存槽位
    db.initializeDate(date);
    
    // 2. 获取可见物料
    const mats = db.getMaterials(date);
    setMaterials(mats);
    
    // 3. 获取所有记录
    const dailyInv = db.getInventoryForDate(date);
    
    // 4. 过滤列表
    const visibleMatIds = new Set(mats.map(m => m.id));
    const filteredInv = dailyInv.filter(item => visibleMatIds.has(item.materialId));
    
    setInventory(filteredInv);
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
    if (!isToday) return;

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
    if (!isToday) {
      alert("历史数据已被锁定，无法删除。");
      return;
    }
    if (window.confirm(`确定要删除物料 "${name}" 吗？删除后该物料将立即从今日列表中消失。`)) {
      db.deleteMaterial(id, date);
      loadData(); // 立即重新加载，触发可见性过滤
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (!isToday) {
      alert("历史数据处于只读模式，无法执行批量删除。");
      return;
    }
    if (window.confirm(`确定要批量删除选中的 ${selectedIds.size} 个物料吗？`)) {
      db.deleteMaterials(Array.from(selectedIds), date);
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
    if (!isToday) {
      alert("只能在今日日期下进行物料导入。");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let count = 0;
        data.forEach((row: any) => {
          const name = row['物料名称'] || row['Name'] || row['名称'];
          const unit = row['物料单位'] || row['Unit'] || row['单位'];
          const initialStock = Number(row['昨日库存'] || row['实时库存'] || row['期初库存'] || row['Opening Stock'] || 0);
          
          if (name && unit) {
            db.addMaterial(name, unit, initialStock, date);
            count++;
          }
        });
        
        loadData(); // 导入后强制刷新 UI
        db.logAction('IMPORT', `从 Excel 批量导入了 ${count} 条物料数据`);
        alert(`成功导入 ${count} 条数据`);
      } catch (err) {
        console.error('Import error:', err);
        alert('导入失败，请检查 Excel 格式是否正确');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; 
  };

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <div className="bg-white p-3 lg:p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜物料名称..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none text-base font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex-1 lg:flex-none relative group">
             <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isToday ? 'text-blue-500' : 'text-amber-500'}`}>
                {isToday ? <CalendarIcon size={16} /> : <Lock size={16} />}
             </div>
             <input
              type="date"
              className={`w-full lg:w-auto pl-10 pr-4 py-3 border rounded-xl font-black outline-none text-sm transition-all focus:ring-2 focus:ring-blue-500 ${isToday ? 'bg-blue-50/50 border-blue-100 text-blue-700' : 'bg-amber-50/50 border-amber-100 text-amber-700'}`}
              value={date}
              max={db.getBeijingDate()}
              onChange={(e) => setDate(e.target.value)}
            />
            {isToday ? (
              <span className="absolute -top-2 -right-1 bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">今日编辑</span>
            ) : (
              <span className="absolute -top-2 -right-1 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm">只读查询</span>
            )}
          </div>

          <label className={`hidden lg:flex items-center px-5 py-3 rounded-xl transition-all font-bold shadow-sm border text-sm ${isToday ? 'bg-indigo-50 text-indigo-600 border-indigo-100 cursor-pointer hover:bg-indigo-100' : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'}`}>
            <Upload size={16} className="mr-2" />
            Excel导入
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={!isToday} />
          </label>

          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!isToday}
            className={`hidden lg:flex items-center px-6 py-3 rounded-xl transition-all font-bold text-sm ${isToday ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'}`}
          >
            <Plus size={16} className="mr-2" />
            新增物料
          </button>
        </div>
      </div>

      {!isToday && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center space-x-3 text-amber-800 animate-in slide-in-from-top duration-300">
           <Lock size={18} className="flex-shrink-0" />
           <p className="text-sm font-bold">您正在查看历史数据 ({date})。根据系统规则，只有北京时间当天的库存数据允许修改。此外，该日期已删除的物料不会显示。</p>
        </div>
      )}

      {selectedIds.size > 0 && isToday && (
        <div className="bg-white p-3 rounded-xl border border-red-100 flex items-center justify-between animate-in slide-in-from-top duration-300 shadow-sm">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mr-3">
              <Trash2 size={16} className="text-red-600" />
            </div>
            <span className="text-sm font-bold text-red-600">已选中 {selectedIds.size} 项物料</span>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setSelectedIds(new Set())} className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">取消选择</button>
            <button onClick={handleBatchDelete} className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg flex items-center shadow-sm shadow-red-200">
              批量删除
            </button>
          </div>
        </div>
      )}

      <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 w-12 text-center">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 transition-colors">
                  {isAllSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                </button>
              </th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">物料信息</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">昨日库存</th>
              <th className="px-6 py-4 text-xs font-bold text-blue-600 uppercase tracking-wider text-center">今日入库</th>
              <th className="px-6 py-4 text-xs font-bold text-orange-600 uppercase tracking-wider text-center">车间出库</th>
              <th className="px-6 py-4 text-xs font-bold text-purple-600 uppercase tracking-wider text-center">店面出库</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider bg-blue-50/50 text-center">今日剩余</th>
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredData.length === 0 ? (
               <tr>
                <td colSpan={8} className="px-6 py-20 text-center text-gray-400">
                  <div className="flex flex-col items-center">
                    <Calculator size={48} className="mb-4 opacity-10" />
                    <p className="font-bold">该日期暂无可见数据</p>
                    <p className="text-xs mt-1 max-w-xs mx-auto">
                      提示：系统仅显示该日期已创建且未被删除的物料。如果刚刚导入了数据，请检查日期选择是否正确。
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map(item => {
                const mat = materials.find(m => m.id === item.materialId);
                if (!mat) return null;
                const isSelected = selectedIds.has(item.materialId);
                return (
                  <tr key={item.id} className={`group transition-all ${isSelected ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => toggleSelect(item.materialId)} className="text-gray-300 hover:text-blue-600 transition-colors">
                        {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{mat.name}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">单位: {mat.unit}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-gray-500">{item.openingStock}</td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        min="0"
                        disabled={!isToday}
                        value={item.todayInbound}
                        onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                        className={`w-24 px-3 py-2 border rounded-xl text-center font-bold outline-none transition-all ${isToday ? 'border-blue-100 text-blue-600 bg-blue-50/20 focus:bg-white focus:ring-2 focus:ring-blue-500' : 'border-gray-50 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        min="0"
                        disabled={!isToday}
                        value={item.workshopOutbound}
                        onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                        className={`w-24 px-3 py-2 border rounded-xl text-center font-bold outline-none transition-all ${isToday ? 'border-orange-100 text-orange-600 bg-orange-50/20 focus:bg-white focus:ring-2 focus:ring-orange-500' : 'border-gray-50 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        min="0"
                        disabled={!isToday}
                        value={item.storeOutbound}
                        onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                        className={`w-24 px-3 py-2 border rounded-xl text-center font-bold outline-none transition-all ${isToday ? 'border-purple-100 text-purple-600 bg-purple-50/20 focus:bg-white focus:ring-2 focus:ring-purple-500' : 'border-gray-50 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-center font-black text-blue-800 bg-blue-50/30 text-lg">
                      {item.remainingStock}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isToday && (
                        <button 
                          onClick={() => handleDeleteMaterial(item.materialId, mat.name)} 
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
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

      <div className="lg:hidden space-y-4">
        {filteredData.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <Calculator size={48} className="mx-auto mb-4 opacity-10" />
            <p className="text-sm font-bold">该日期暂无可见物料</p>
          </div>
        ) : (
          filteredData.map(item => {
            const mat = materials.find(m => m.id === item.materialId);
            if (!mat) return null;
            const isSelected = selectedIds.has(item.materialId);
            const isLowStock = item.remainingStock < config.LOW_STOCK_THRESHOLD;
            return (
              <div key={item.id} className={`bg-white rounded-3xl p-5 shadow-sm border-2 transition-all ${isSelected ? 'border-blue-500 bg-blue-50/5' : 'border-gray-50'}`}>
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center space-x-4">
                    <button onClick={() => toggleSelect(item.materialId)} className="text-gray-300">
                      {isSelected ? <CheckSquare size={26} className="text-blue-600" /> : <Square size={26} />}
                    </button>
                    <div>
                      <h4 className="text-xl font-black text-gray-900 leading-tight">{mat.name}</h4>
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-1">单位: {mat.unit}</p>
                    </div>
                  </div>
                  {isToday && (
                    <button onClick={() => handleDeleteMaterial(item.materialId, mat.name)} className="p-2 text-gray-300 active:text-red-500 bg-gray-50 rounded-full">
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-3 mb-5">
                   <div className="bg-gray-100/80 p-3 rounded-2xl text-center flex flex-col justify-center">
                     <span className="block text-[10px] text-gray-500 font-black mb-1">昨日</span>
                     <span className="block font-mono font-black text-gray-700 text-lg">{item.openingStock}</span>
                   </div>
                   <div className="col-span-3 grid grid-cols-3 gap-2">
                     <div className="text-center">
                        <label className={`block text-[10px] font-black mb-1.5 uppercase ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>入库</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          disabled={!isToday}
                          value={item.todayInbound}
                          onChange={(e) => handleInputChange(item.materialId, 'todayInbound', e.target.value)}
                          className={`w-full py-3 border-2 rounded-2xl text-center font-black outline-none transition-all text-lg ${isToday ? 'bg-blue-50 border-blue-100 text-blue-700 focus:border-blue-500' : 'bg-gray-50 border-gray-50 text-gray-400 cursor-not-allowed'}`}
                        />
                     </div>
                     <div className="text-center">
                        <label className={`block text-[10px] font-black mb-1.5 uppercase ${isToday ? 'text-orange-600' : 'text-gray-400'}`}>车间</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          disabled={!isToday}
                          value={item.workshopOutbound}
                          onChange={(e) => handleInputChange(item.materialId, 'workshopOutbound', e.target.value)}
                          className={`w-full py-3 border-2 rounded-2xl text-center font-black outline-none transition-all text-lg ${isToday ? 'bg-orange-50 border-orange-100 text-orange-700 focus:border-orange-500' : 'bg-gray-50 border-gray-50 text-gray-400 cursor-not-allowed'}`}
                        />
                     </div>
                     <div className="text-center">
                        <label className={`block text-[10px] font-black mb-1.5 uppercase ${isToday ? 'text-purple-600' : 'text-gray-400'}`}>店面</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          disabled={!isToday}
                          value={item.storeOutbound}
                          onChange={(e) => handleInputChange(item.materialId, 'storeOutbound', e.target.value)}
                          className={`w-full py-3 border-2 rounded-2xl text-center font-black outline-none transition-all text-lg ${isToday ? 'bg-purple-50 border-purple-100 text-purple-700 focus:border-purple-500' : 'bg-gray-50 border-gray-50 text-gray-400 cursor-not-allowed'}`}
                        />
                     </div>
                   </div>
                </div>

                <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                  <div className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <Calculator size={14} className="mr-1.5" />
                    今日剩余统计
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-400 font-bold">STOCK:</span>
                    <span className={`text-2xl font-black ${isLowStock ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
                      {item.remainingStock}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isToday && (
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="lg:hidden fixed bottom-8 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 active:bg-blue-700 transition-all z-50 border-4 border-white"
          aria-label="新增物料"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[3rem] sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in slide-in-from-bottom duration-300">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-gray-900">新增物料记录</h3>
                <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">Date: {date}</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-3 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={(e: any) => {
              e.preventDefault();
              const name = e.target.name.value;
              const unit = e.target.unit.value;
              const initialStock = Number(e.target.initialStock.value || 0);
              db.addMaterial(name, unit, initialStock, date);
              loadData();
              setIsAddModalOpen(false);
            }} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">物料名称 Material Name</label>
                <input name="name" required autoFocus className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 text-lg font-bold transition-all" placeholder="例如: 轴承 A-101" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">计算单位 Unit</label>
                <input name="unit" required className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold transition-all text-lg" placeholder="如: kg, 个, 箱" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">昨日库存 (仅限新增物料期初) Initial Stock</label>
                <input name="initialStock" type="number" min="0" defaultValue="0" className="w-full px-5 py-4 bg-blue-50/50 border-2 border-blue-100 rounded-2xl outline-none focus:border-blue-500 text-3xl font-black text-blue-600 transition-all" />
              </div>
              <div className="pt-4 flex space-x-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm uppercase tracking-widest">取消</button>
                <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-200">确认添加</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
