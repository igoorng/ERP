
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
    *执行后请记下输出中的 `database_id`。*

3.  **初始化表结构**:
    在项目根目录创建 `schema.sql` 并写入以下内容：
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
    ```
    执行初始化命令：
    ```bash
    wrangler d1 execute material-db --file=./schema.sql
    ```

## 3. 部署到 Cloudflare Pages

1.  **项目打包**:
    本系统为 Vite 项目，执行：
    ```bash
    npm run build
    ```
2.  **部署 Pages**:
    ```bash
    wrangler pages deploy dist --project-name=material-flow
    ```

## 4. 绑定数据库绑定 (关键步骤)

部署完成后，你需要告诉 Cloudflare 你的前端 API 如何连接 D1 数据库：

1.  登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> 点击你的项目 `material-flow`。
3.  点击 **Settings (设置)** -> **Functions (函数)**。
4.  在 **D1 database bindings (D1 数据库绑定)** 处，点击 **Add binding (添加绑定)**。
5.  **Variable name (变量名)** 填入：`DB` (必须是大写)。
6.  **D1 database** 选择你刚才创建的：`material-db`。
7.  点击 **Save (保存)**。
8.  **重新部署一次** 以使绑定生效：
    ```bash
    wrangler pages deploy dist
    ```

## 5. 首次运行

1.  访问你的 Pages 域名 (如 `https://material-flow.pages.dev`)。
2.  由于数据库初始为空，系统会自动触发 `/api/auth/init` 接口。
3.  使用默认账号登录：
    *   **用户名**: `admin`
    *   **密码**: `admin`
4.  登录后请在设置或通过数据库工具修改初始密码。

## 开发调试

如果你想在本地预览连接 D1 数据库的效果：
```bash
wrangler pages dev dist --d1=DB=你的数据库ID
```

---
*MaterialFlow Systems v1.2 - Cloud-Native Edition*
