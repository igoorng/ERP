export const config = {
  // 今日缺料预警阈值
  LOW_STOCK_THRESHOLD: Number(import.meta.env.VITE_LOW_STOCK_THRESHOLD || 10),
  // 系统默认账号
  APP_USERNAME: import.meta.env.VITE_APP_USERNAME || 'admin',
  // 系统默认密码
  APP_PASSWORD: import.meta.env.VITE_APP_PASSWORD || 'admin@123',
};
