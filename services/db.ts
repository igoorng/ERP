
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
    // 强制输出 YYYY-MM-DD 格式，避免 / 分隔符干扰
    const now = new Date();
    const offset = 8 * 60; // Beijing is UTC+8
    const beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() + offset) * 60000);
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getBeijingTimeOnly: (): string => {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
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
  getAllMaterials: (): Material[] => {
    const data = localStorage.getItem(KEYS.MATERIALS);
    return data ? JSON.parse(data) : [];
  },

  /**
   * 获取特定日期可见的物料
   * 逻辑修改：
   * 1. 如果物料有 createdAt，则 date >= createdAt 
   * 2. 如果物料有 deletedAt，则 date < deletedAt (删除当天即隐藏)
   */
  getMaterials: (date?: string): Material[] => {
    const materials = db.getAllMaterials();
    if (!date) return materials.filter(m => !m.deletedAt);
    
    return materials.filter(m => {
      // 标准化比较，防止 / 分隔符干扰
      const targetDate = date.replace(/\//g, '-');
      const createDate = (m.createdAt || '').replace(/\//g, '-');
      const deleteDate = (m.deletedAt || '').replace(/\//g, '-');

      const isCreated = !createDate || createDate <= targetDate;
      // 修改点：如果 date 等于 deleteDate，则不显示 (date < deleteDate)
      const isNotDeleted = !deleteDate || targetDate < deleteDate;
      
      return isCreated && isNotDeleted;
    });
  },

  addMaterial: (name: string, unit: string, initialStock: number = 0, date: string) => {
    const materials = db.getAllMaterials();
    const normalizedDate = date.replace(/\//g, '-');
    
    // 检查是否已有同名且未删除物料
    let mat = materials.find(m => m.name === name && !m.deletedAt);
    
    if (!mat) {
      mat = {
        id: Math.random().toString(36).slice(2, 11),
        name,
        unit,
        createdAt: normalizedDate
      };
      materials.push(mat);
      localStorage.setItem(KEYS.MATERIALS, JSON.stringify(materials));
      db.logAction('CREATE', `新增物料: ${name}, 昨日库存: ${initialStock}`);
    } else {
      // 兼容旧数据补全创建日期
      if (!mat.createdAt) {
        mat.createdAt = normalizedDate;
        localStorage.setItem(KEYS.MATERIALS, JSON.stringify(materials));
      }
    }

    // 关键修复：导入后立即初始化库存记录，防止 InventoryView 加载不到数据
    const data = localStorage.getItem(KEYS.INVENTORY);
    let allLogs: DailyInventory[] = data ? JSON.parse(data) : [];
    
    const existingIndex = allLogs.findIndex(l => l.materialId === mat!.id && l.date === normalizedDate);
    if (existingIndex === -1) {
      const newRecord: DailyInventory = {
        id: Math.random().toString(36).slice(2, 11),
        materialId: mat.id,
        date: normalizedDate,
        openingStock: initialStock,
        todayInbound: 0,
        workshopOutbound: 0,
        storeOutbound: 0,
        remainingStock: initialStock
      };
      allLogs.push(newRecord);
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
      db.cascadeUpdate(mat.id, normalizedDate, initialStock);
    } else {
      // 如果已存在且是批量导入，更新期初库存
      allLogs[existingIndex].openingStock = initialStock;
      allLogs[existingIndex].remainingStock = initialStock + allLogs[existingIndex].todayInbound - allLogs[existingIndex].workshopOutbound - allLogs[existingIndex].storeOutbound;
      localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
      db.cascadeUpdate(mat.id, normalizedDate, allLogs[existingIndex].remainingStock);
    }

    return mat;
  },

  deleteMaterials: (ids: string[], date: string) => {
    if (ids.length === 0) return;
    const materials = db.getAllMaterials();
    const normalizedDate = date.replace(/\//g, '-');
    const updatedMaterials = materials.map(m => {
      if (ids.includes(m.id)) {
        return { ...m, deletedAt: normalizedDate };
      }
      return m;
    });
    localStorage.setItem(KEYS.MATERIALS, JSON.stringify(updatedMaterials));
    db.logAction('DELETE', `删除物料: 已在 ${normalizedDate} 立即隐藏`);
  },

  deleteMaterial: (id: string, date: string) => {
    db.deleteMaterials([id], date);
  },

  getInventoryForDate: (date: string): DailyInventory[] => {
    const normalizedDate = date.replace(/\//g, '-');
    const data = localStorage.getItem(KEYS.INVENTORY);
    const allLogs: DailyInventory[] = data ? JSON.parse(data) : [];
    return allLogs.filter(l => l.date === normalizedDate);
  },

  saveInventoryRecord: (record: DailyInventory) => {
    const data = localStorage.getItem(KEYS.INVENTORY);
    let allLogs: DailyInventory[] = data ? JSON.parse(data) : [];
    record.date = record.date.replace(/\//g, '-');
    record.remainingStock = record.openingStock + record.todayInbound - record.workshopOutbound - record.storeOutbound;
    const index = allLogs.findIndex(l => l.materialId === record.materialId && l.date === record.date);
    if (index > -1) allLogs[index] = record;
    else allLogs.push(record);
    localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
    db.cascadeUpdate(record.materialId, record.date, record.remainingStock);
  },

  cascadeUpdate: (materialId: string, fromDate: string, newOpeningForNext: number) => {
    const data = localStorage.getItem(KEYS.INVENTORY);
    if (!data) return;
    let allLogs: DailyInventory[] = JSON.parse(data);
    const normalizedFromDate = fromDate.replace(/\//g, '-');
    
    const sortedRecords = allLogs
      .filter(l => l.materialId === materialId)
      .sort((a, b) => a.date.localeCompare(b.date));
      
    let currentOpening = newOpeningForNext;
    let modified = false;
    
    sortedRecords.forEach(record => {
      if (record.date > normalizedFromDate) {
        const idx = allLogs.findIndex(l => l.id === record.id);
        if (idx > -1) {
          allLogs[idx].openingStock = currentOpening;
          allLogs[idx].remainingStock = allLogs[idx].openingStock + allLogs[idx].todayInbound - allLogs[idx].workshopOutbound - allLogs[idx].storeOutbound;
          currentOpening = allLogs[idx].remainingStock;
          modified = true;
        }
      }
    });
    if (modified) localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
  },

  initializeDate: (date: string) => {
    const normalizedDate = date.replace(/\//g, '-');
    const materials = db.getMaterials(normalizedDate);
    const currentDayRecords = db.getInventoryForDate(normalizedDate);
    const allData = localStorage.getItem(KEYS.INVENTORY);
    const allLogs: DailyInventory[] = allData ? JSON.parse(allData) : [];
    
    const prevDates = Array.from(new Set(allLogs.map(l => l.date))).sort().filter(d => d < normalizedDate);
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
          date: normalizedDate, 
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
    if (updatedRecords.length > 0) localStorage.setItem(KEYS.INVENTORY, JSON.stringify(allLogs));
  },

  getAggregatedStatistics: (startDate: string, endDate: string) => {
    const s = startDate.replace(/\//g, '-');
    const e = endDate.replace(/\//g, '-');
    const materials = db.getAllMaterials();
    const inventoryData = localStorage.getItem(KEYS.INVENTORY);
    const allInv: DailyInventory[] = inventoryData ? JSON.parse(inventoryData) : [];
    
    const rangeInv = allInv.filter(item => item.date >= s && item.date <= e);
    
    const result = materials.map(mat => {
      const matInv = rangeInv.filter(i => i.materialId === mat.id);
      const totalIn = matInv.reduce((sum, i) => sum + i.todayInbound, 0);
      const totalWorkshop = matInv.reduce((sum, i) => sum + i.workshopOutbound, 0);
      const totalStore = matInv.reduce((sum, i) => sum + i.storeOutbound, 0);
      
      const sortedMatInv = allInv.filter(i => i.materialId === mat.id && i.date <= e).sort((a,b) => b.date.localeCompare(a.date));
      const currentStock = sortedMatInv.length > 0 ? sortedMatInv[0].remainingStock : 0;
      
      if (matInv.length === 0 && currentStock === 0) return null;

      return {
        id: mat.id,
        name: mat.name,
        unit: mat.unit,
        totalIn,
        totalWorkshop,
        totalStore,
        currentStock
      };
    }).filter(Boolean);

    return result;
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
