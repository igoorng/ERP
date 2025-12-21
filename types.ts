
export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  createdAt: string; // YYYY-MM-DD
  deletedAt?: string; // YYYY-MM-DD (逻辑删除日期)
}

export interface DailyInventory {
  id: string;
  materialId: string;
  date: string; // YYYY-MM-DD
  openingStock: number; // 实时库存 (at start of day)
  todayInbound: number; // 今日入库
  workshopOutbound: number; // 车间出库
  storeOutbound: number; // 店面出库
  remainingStock: number; // 今日剩余库存
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
