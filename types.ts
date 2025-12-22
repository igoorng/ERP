export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  baseUnit: string; // 新增：基本计量单位
  createdAt: number; // Unix Timestamp (ms)
  deletedAt?: number; // Unix Timestamp (ms)
}

export interface DailyInventory {
  id: string;
  materialId: string;
  date: string; // YYYY-MM-DD (库存依然按天聚合)
  openingStock: number; 
  todayInbound: number; 
  workshopOutbound: number; 
  storeOutbound: number; 
  remainingStock: number; 
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  timestamp: string;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  STATISTICS = 'STATISTICS',
  REPORTS = 'REPORTS',
  LOGS = 'LOGS',
  SETTINGS = 'SETTINGS'
}