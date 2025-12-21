
import { Material, DailyInventory, AuditLog, User } from '../types';
import { config } from './config';

// Storage keys
const DB_PREFIX = 'mf_pro_';
const KEYS = {
  MATERIALS: DB_PREFIX + 'materials',
  INVENTORY: DB_PREFIX + 'inventory',
  LOGS: DB_PREFIX + 'logs',
  USERS: DB_PREFIX + 'users',
  SESSION: DB_PREFIX + 'session'
};

// 使用 Web Crypto API 实现 SHA-256 哈希
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const db = {
  // --- Time Utilities (Beijing Time UTC+8) ---
  getBeijingDate: (): string => {
    // 使用 sv-SE 区域设置可以稳定获得 YYYY-MM-DD 格式
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  },

  getBeijingTimestamp: (): string => {
    return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  },

  // --- Auth & Users ---
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.SESSION);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    else localStorage.removeItem(KEYS.SESSION);
  },

  // 系统初始化：确保数据库中存在哈希后的默认管理员
  initAuth: async () => {
    const usersStr = localStorage.getItem(KEYS.USERS);
    let users = usersStr ? JSON.parse(usersStr) : [];
    
    if (users.length === 0) {
      const hashedPass = await hashPassword(config.APP_PASSWORD);
      const defaultUser = {
        id: 'admin-id',
        username: config.APP_USERNAME,
        passwordHash: hashedPass,
        role: 'admin'
      };
      users.push(defaultUser);
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      db.logAction('SYSTEM', '系统初始化：已安全创建加密管理员账户');
    }
  },

  // 安全身份验证：比对哈希值
  authenticate: async (username: string, password: string): Promise<User | null> => {
    const usersStr = localStorage.getItem(KEYS.USERS);
    const users = usersStr ? JSON.parse(usersStr) : [];
    const hashedInput = await hashPassword(password);
    
    const user = users.find((u: any) => u.username === username && u.passwordHash === hashedInput);
    if (user) {
      const { passwordHash, ...safeUser } = user;
      return safeUser as User;
    }
    return null;
  },

  // --- Materials ---
  getMaterials: (): Material[] => {
    const data = localStorage.getItem(KEYS.MATERIALS);
    return data ? JSON.parse(data) : [];
  },

  addMaterial: (name: string, unit: string, initialStock: number = 0, date: string) => {
    const materials = db.getMaterials();
    const newMaterial: Material = {
      id: Math.random().toString(36).slice(2, 11),
      name,
      unit,
      createdAt: db.getBeijingTimestamp()
    };
    materials.push(newMaterial);
    localStorage.setItem(KEYS.MATERIALS, JSON.stringify(materials));
    
    const inventoryData = localStorage.getItem(KEYS.INVENTORY);
    let allLogs: DailyInventory[] = inventoryData ? JSON.parse(inventoryData) : [];
    
    const newRecord: DailyInventory = {
      id: Math.random().toString(36).slice(2, 11),
      materialId: newMaterial.id,
      date,
      openingStock: initialStock,
      todayInbound: 0,
      workshopOutbound: 0,
      storeOutbound: 0,
      remainingStock: initialStock
    };
    allLogs.push(newRecord);
    localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));

    db.logAction('CREATE', `新增物料: ${name} (${unit}), 昨日库存: ${initialStock}`);
    db.cascadeUpdate(newMaterial.id, date, initialStock);
    return newMaterial;
  },

  deleteMaterial: (id: string) => {
    db.deleteMaterials([id]);
  },

  deleteMaterials: (ids: string[]) => {
    if (ids.length === 0) return;
    const materials = db.getMaterials();
    const materialsToDelete = materials.filter(m => ids.includes(m.id));
    
    const updatedMaterials = materials.filter(m => !ids.includes(m.id));
    localStorage.setItem(KEYS.MATERIALS, JSON.stringify(updatedMaterials));

    const inventoryData = localStorage.getItem(KEYS.INVENTORY);
    if (inventoryData) {
      const allInventory: DailyInventory[] = JSON.parse(inventoryData);
      const updatedInventory = allInventory.filter(item => !ids.includes(item.materialId));
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(updatedInventory));
    }

    const names = materialsToDelete.map(m => m.name).join(', ');
    db.logAction('DELETE', `批量删除物料: ${names}`);
  },

  getInventoryForDate: (date: string): DailyInventory[] => {
    const data = localStorage.getItem(KEYS.INVENTORY);
    const allLogs: DailyInventory[] = data ? JSON.parse(data) : [];
    return allLogs.filter(l => l.date === date);
  },

  saveInventoryRecord: (record: DailyInventory) => {
    const data = localStorage.getItem(KEYS.INVENTORY);
    let allLogs: DailyInventory[] = data ? JSON.parse(data) : [];
    
    record.remainingStock = record.openingStock + record.todayInbound - record.workshopOutbound - record.storeOutbound;

    const index = allLogs.findIndex(l => l.materialId === record.materialId && l.date === record.date);
    if (index > -1) {
      allLogs[index] = record;
    } else {
      allLogs.push(record);
    }
    localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
    db.cascadeUpdate(record.materialId, record.date, record.remainingStock);
  },

  cascadeUpdate: (materialId: string, fromDate: string, newOpeningForNext: number) => {
    const data = localStorage.getItem(KEYS.INVENTORY);
    if (!data) return;
    let allLogs: DailyInventory[] = JSON.parse(data);

    const sortedRecords = allLogs
      .filter(l => l.materialId === materialId)
      .sort((a, b) => a.date.localeCompare(b.date));

    let currentOpening = newOpeningForNext;
    let modified = false;

    sortedRecords.forEach(record => {
      if (record.date > fromDate) {
        const originalIndex = allLogs.findIndex(l => l.id === record.id);
        if (originalIndex > -1) {
          allLogs[originalIndex].openingStock = currentOpening;
          allLogs[originalIndex].remainingStock = 
            allLogs[originalIndex].openingStock + 
            allLogs[originalIndex].todayInbound - 
            allLogs[originalIndex].workshopOutbound - 
            allLogs[originalIndex].storeOutbound;
          
          currentOpening = allLogs[originalIndex].remainingStock;
          modified = true;
        }
      }
    });

    if (modified) {
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
    }
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
          id: Math.random().toString(36).slice(2, 11),
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
      timestamp: db.getBeijingTimestamp()
    };
    logs.unshift(newLog);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs.slice(0, 1000)));
  }
};
