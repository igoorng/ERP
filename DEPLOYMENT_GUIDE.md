# MaterialFlow Pro 部署指南 (Cloudflare 版)

## 解决“INSERT 报错”或“D1 没有表”的问题

如果你在执行 SQL 时报错，通常是因为先尝试了 `INSERT` 但表还没创建。请按照以下步骤重新操作：

### 1. 确保 schema.sql 内容最新
请确保你的 `schema.sql` 文件中，所有表名和 `key` 字段都用双引号包裹（例如 `"settings"`, `"key"`）。

### 2. 执行完整的远程初始化
在项目根目录运行以下命令。这会**按顺序**创建表并插入初始数据：

```bash
# 运行远程初始化脚本
wrangler d1 execute material-db --remote --file=./schema.sql
```

### 3. 验证表结构
运行以下命令确认表是否存在：
```bash
wrangler d1 execute material-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 4. 验证初始数据
运行以下命令确认设置表是否已有数据：
```bash
wrangler d1 execute material-db --remote --command="SELECT * FROM \"settings\";"
```

---

## 配置文件 (wrangler.toml) 提醒
请确保 ID 是 32 位十六进制字符串（由数字和 a-f 组成）：

```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[d1_databases]]
binding = "DB"
database_name = "material-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 部署项目
```bash
npm run build
wrangler pages deploy dist --project-name=material-flow-pro
```

---
*初始账号: admin / 密码: admin*