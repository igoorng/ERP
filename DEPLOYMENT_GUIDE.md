# MaterialFlow Pro 部署指南 (Cloudflare 全栈版)

本手册详细介绍了如何将 **MaterialFlow Pro** 部署到 Cloudflare 平台。本系统采用了 Cloudflare Pages (前端/接口)、D1 (关系型数据库) 以及 KV (高性能边缘缓存) 的全栈架构。

---

## 1. 环境准备

在开始之前，请确保您的本地环境已安装：
*   **Node.js** (v18 或更高版本)
*   **npm** 或 **yarn**
*   **Cloudflare 账号**

安装 Cloudflare 开发者工具 Wrangler：
```bash
npm install -g wrangler
```

---

## 2. 数据库配置 (Cloudflare D1)

D1 是 Cloudflare 提供的无服务器 SQL 数据库，用于存储物料数据、库存记录和用户信息。

1.  **登录 Cloudflare**:
    ```bash
    wrangler login
    ```

2.  **创建 D1 数据库**:
    ```bash
    wrangler d1 create material-db
    ```
    *记录下输出中的 `database_id`，稍后需要填入 `wrangler.toml`。*

3.  **初始化数据库表结构**:
    使用项目根目录下的 `schema.sql` 文件进行初始化：
    ```bash
    wrangler d1 execute material-db --file=./schema.sql
    ```

---

## 3. 缓存配置 (Cloudflare KV)

KV 用于存储 API 查询结果的快照，显著提升高频查询（如物料列表、看板统计）的响应速度，并减少 D1 数据库的负载。

1.  **创建 KV 命名空间**:
    ```bash
    wrangler kv:namespace create MATERIALFLOW_CACHE
    ```
    *记录下输出中的 `id`，稍后需要填入 `wrangler.toml`。*

---

## 4. 配置文件 (wrangler.toml)

在项目根目录创建或编辑 `wrangler.toml`，确保其内容如下（替换其中的 ID）：

```toml
name = "material-flow-pro"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB" # 必须为 DB，代码中以此名称调用
database_name = "material-db"
database_id = "你的_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "CACHE_KV" # 必须为 CACHE_KV，代码中以此名称调用
id = "你的_KV_NAMESPACE_ID"
```

---

## 5. 项目构建与部署

1.  **安装依赖**:
    ```bash
    npm install
    ```

2.  **项目打包**:
    ```bash
    npm run build
    ```

3.  **部署到 Pages**:
    ```bash
    wrangler pages deploy dist --project-name=material-flow-pro
    ```

---

## 6. 云端后台配置 (关键步骤)

由于 Cloudflare Pages 的环境变量和绑定需要在控制面板再次确认：

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> **你的项目名称 (material-flow-pro)**。
3.  点击 **Settings (设置)** -> **Functions (函数)**。
4.  在 **D1 database bindings** 处，添加一个绑定：
    *   **Variable name**: `DB`
    *   **D1 database**: 选择 `material-db`
5.  在 **KV namespace bindings** 处，添加一个绑定：
    *   **Variable name**: `CACHE_KV`
    *   **KV namespace**: 选择 `MATERIALFLOW_CACHE`
6.  **重新部署**（或在 Deployment 页面重新触发构建）以应用这些绑定。

---

## 7. 初始登录凭据

部署完成后，首次访问系统请使用以下默认账号：

*   **初始管理员账号**: `admin`
*   **初始管理员密码**: `admin`

> **安全提示**: 登录后，请务必前往“系统配置” -> “权限管理”修改管理员密码，或创建新的管理员账号并删除默认账号。

---

## 8. 缓存管理

*   **性能监控**: 您可以通过系统内的“缓存性能测试”页面查看 KV 缓存的命中率和响应时间。
*   **手动清理**: 如果发现数据同步异常，可以在“系统配置”中点击“清空边缘缓存”。

---
*MaterialFlow Systems v1.8 - 全栈云原生架构*
