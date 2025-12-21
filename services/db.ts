
import { Material, DailyInventory, AuditLog, User } from '../types';

// Storage keys
const DB_PREFIX = 'mf_pro_';
const KEYS = {
  MATERIALS: DB_PREFIX + 'materials',
  INVENTORY: DB_PREFIX + 'inventory',
  LOGS: DB_PREFIX + 'logs',
  USERS: DB_PREFIX + 'users',
  SESSION: DB_PREFIX + 'session'
};

export const db = {
  // --- Auth & Users ---
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.SESSION);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    else localStorage.removeItem(KEYS.SESSION);
  },

  // --- Materials ---
  getMaterials: (): Material[] => {
    const data = localStorage.getItem(KEYS.MATERIALS);
    return data ? JSON.parse(data) : [];
  },

  addMaterial: (name: string, unit: string) => {
    const materials = db.getMaterials();
    const newMaterial: Material = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      unit,
      createdAt: new Date().toISOString()
    };
    materials.push(newMaterial);
    localStorage.setItem(KEYS.MATERIALS, JSON.stringify(materials));
    db.logAction('CREATE', `新增物料: ${name} (${unit})`);
    return newMaterial;
  },

  deleteMaterial: (id: string) => {
    db.deleteMaterials([id]);
  },

  deleteMaterials: (ids: string[]) => {
    if (ids.length === 0) return;
    const materials = db.getMaterials();
    const materialsToDelete = materials.filter(m => ids.includes(m.id));
    
    // 1. 删除物料定义
    const updatedMaterials = materials.filter(m => !ids.includes(m.id));
    localStorage.setItem(KEYS.MATERIALS, JSON.stringify(updatedMaterials));

    // 2. 清理关联的库存记录
    const inventoryData = localStorage.getItem(KEYS.INVENTORY);
    if (inventoryData) {
      const allInventory: DailyInventory[] = JSON.parse(inventoryData);
      const updatedInventory = allInventory.filter(item => !ids.includes(item.materialId));
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(updatedInventory));
    }

    const names = materialsToDelete.map(m => m.name).join(', ');
    db.logAction('DELETE', `批量删除物料: ${names}`);
  },

  // --- Inventory & Calculations ---
  getInventoryForDate: (date: string): DailyInventory[] => {
    const data = localStorage.getItem(KEYS.INVENTORY);
    const allLogs: DailyInventory[] = data ? JSON.parse(data) : [];
    return allLogs.filter(l => l.date === date);
  },

  saveInventoryRecord: (record: DailyInventory) => {
    const data = localStorage.getItem(KEYS.INVENTORY);
    let allLogs: DailyInventory[] = data ? JSON.parse(data) : [];
    
    // 实时计算：实时库存 + 今日入库 - 车间出库 - 店面出库 = 今日剩余库存
    record.remainingStock = record.openingStock + record.todayInbound - record.workshopOutbound - record.storeOutbound;

    const index = allLogs.findIndex(l => l.materialId === record.materialId && l.date === record.date);
    if (index > -1) {
      allLogs[index] = record;
    } else {
      allLogs.push(record);
    }
    localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
  },

  initializeDate: (date: string) => {
    const materials = db.getMaterials();
    const currentDayRecords = db.getInventoryForDate(date);
    
    const allData = localStorage.getItem(KEYS.INVENTORY);
    const allLogs: DailyInventory[] = allData ? JSON.parse(allData) : [];
    const prevDates = Array.from(new Set(allLogs.map(l => l.date))).sort().filter(d => d < date);
    const lastDate = prevDates.length > 0 ? prevDates[prevDates.length - 1] : null;

    const updatedRecords: DailyInventory[] = [];

    materials.forEach(m => {
      const existing = currentDayRecords.find(r => r.materialId === m.id);
      if (!existing) {
        let opening = 0;
        if (lastDate) {
          const lastRecord = allLogs.find(r => r.materialId === m.id && r.date === lastDate);
          opening = lastRecord ? lastRecord.remainingStock : 0;
        }

        const newRecord: DailyInventory = {
          id: Math.random().toString(36).substr(2, 9),
          materialId: m.id,
          date,
          openingStock: opening,
          todayInbound: 0,
          workshopOutbound: 0,
          storeOutbound: 0,
          remainingStock: opening
        };
        updatedRecords.push(newRecord);
        allLogs.push(newRecord);
      }
    });

    if (updatedRecords.length > 0) {
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
    }
  },

  // --- Audit Logs ---
  getLogs: (): AuditLog[] => {
    const data = localStorage.getItem(KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  },

  logAction: (action: string, details: string) => {
    const user = db.getCurrentUser();
    const logs = db.getLogs();
    const newLog: AuditLog = {
      id: Date.now().toString(),
      userId: user?.id || 'system',
      username: user?.username || 'System',
      action,
      details,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs.slice(0, 1000)));
  }
};
