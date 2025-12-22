# MaterialFlow Pro 部署指南 (Cloudflare D1 版)

本手册详细介绍了如何将 MaterialFlow Pro 部署到 Cloudflare 平台，并使用 Cloudflare D1 作为持久化 SQL 数据库。

## 1. 初始化表结构

在项目根目录创建 `schema.sql` 并写入内容：
```sql
CREATE TABLE IF NOT EXISTS "users" ("id" TEXT PRIMARY KEY, "username" TEXT UNIQUE, "password_hash" TEXT, "role" TEXT);
CREATE TABLE IF NOT EXISTS "materials" ("id" TEXT PRIMARY KEY, "name" TEXT, "unit" TEXT, "base_unit" TEXT, "created_at" INTEGER, "deleted_at" INTEGER);
CREATE TABLE IF NOT EXISTS "inventory" (
  "id" TEXT PRIMARY KEY, 
  "material_id" TEXT, 
  "date" TEXT, 
  "opening_stock" REAL, 
  "today_inbound" REAL, 
  "workshop_outbound" REAL, 
  "store_outbound" REAL, 
  "remaining_stock" REAL
);
CREATE TABLE IF NOT EXISTS "audit_logs" ("id" TEXT PRIMARY KEY, "user_id" TEXT, "username" TEXT, "action" TEXT, "details" TEXT, "timestamp" TEXT);
CREATE TABLE IF NOT EXISTS "settings" ("key" TEXT PRIMARY KEY, "value" TEXT);
```

## 2. 边缘缓存配置
本系统支持 Cloudflare KV 加速。请在 `wrangler.toml` 中绑定 `CACHE_KV` 命名空间。

## 3. 默认凭据
*   **初始账号**: `admin`
*   **初始密码**: `admin`

---
*MaterialFlow Systems v1.8 - Edge Cloud Edition*