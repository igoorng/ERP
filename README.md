
# MaterialFlow Pro 部署指南 (Cloudflare D1 版)

本手册详细介绍了如何将 MaterialFlow Pro 部署到 Cloudflare 平台，并使用 Cloudflare D1 作为持久化 SQL 数据库。

## 1. 前期准备

*   安装 [Node.js](https://nodejs.org/)。
*   注册 [Cloudflare](https://dash.cloudflare.com/) 账号。
*   安装 Wrangler CLI (Cloudflare 开发者工具):
    ```bash
    npm install -g wrangler
    ```

## 2. 创建并配置 D1 数据库

1.  **登录 Cloudflare**:
    ```bash
    wrangler login
    ```
2.  **创建数据库**:
    ```bash
    wrangler d1 create material-db
    ```

3.  **初始化表结构**:
    在项目根目录创建 `schema.sql` 并写入内容：
    ```sql
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT);
    CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, name TEXT, unit TEXT, created_at TEXT, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY, 
      material_id TEXT, 
      date TEXT, 
      opening_stock REAL, 
      today_inbound REAL, 
      workshop_outbound REAL, 
      store_outbound REAL, 
      remaining_stock REAL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TEXT);
    -- 新增设置表
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    ```
    执行初始化：
    ```bash
    wrangler d1 execute material-db --file=./schema.sql
    ```

## 3. 部署到 Cloudflare Pages

1.  **项目打包**: `npm run build`
2.  **部署 Pages**:
    ```bash
    wrangler pages deploy dist --project-name=material-flow
    ```

## 4. 绑定数据库 (D1 Binding)
在 Cloudflare 控制台 -> Pages 项目 -> Settings -> Functions -> D1 Database Bindings 中添加：
*   **Variable Name**: `DB`
*   **D1 Database**: `material-db`

## 5. 默认凭据
*   **初始账号**: `admin`
*   **初始密码**: `admin`
*   **默认预警阈值**: `10`

---
*MaterialFlow Systems v1.3 - Dynamic Config Edition*
