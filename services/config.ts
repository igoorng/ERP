
export const config = {
  // 今日缺料预警阈值
  LOW_STOCK_THRESHOLD: Number(process.env.LOW_STOCK_THRESHOLD || 10),
  // 系统默认账号
  APP_USERNAME: process.env.APP_USERNAME || 'admin',
  // 系统默认密码
  APP_PASSWORD: process.env.APP_PASSWORD || 'admin',
};
