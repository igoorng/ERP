# MaterialFlow Pro - 物料管理系统

MaterialFlow Pro 是一款为中小型车间和门店设计的专业物料管理系统。系统专注于库存流转的实时计算、数据审计以及便捷的报表导出，帮助企业实现物料管理的数字化。

## 核心功能

1.  **看板管理**：实时查看物料名称、单位、当前库存、今日入库、车间出库及店面出库。
2.  **智能库存计算**：
    *   计算公式：`今日剩余库存 = 实时库存(期初) + 今日入库 - 车间出库 - 店面出库`。
    *   系统自动将当日的“剩余库存”结转为次日的“实时库存”。
3.  **Excel 联动**：
    *   支持通过 Excel 批量导入物料基础信息（名称、单位）。
    *   支持一键导出每日库存统计报表。
4.  **安全授权**：内置用户登录系统，保护数据安全。
5.  **审计日志**：完整记录所有用户的增、删、改、查行为，确保每一笔数据流转均可追溯。
6.  **响应式设计**：适配 PC、平板及移动端，随时随地管理库存。

## 技术栈

*   **前端**：React 19, Tailwind CSS (UI), Lucide React (图标)
*   **图表**：Recharts
*   **数据处理**：SheetJS (Excel 导入导出)
*   **数据存储**：当前版本使用浏览器持久化存储（LocalStorage 模拟 SQLite 行为），私有化部署可无缝对接后端。

---

## 私有化部署指南

本系统可以作为静态资源部署，也可以通过 Docker 进行容器化私有化部署。

### 方式一：静态 Web 服务器部署 (Nginx)

这是最轻量级的部署方式。

1.  **构建项目**：
    ```bash
    npm run build
    ```
2.  **配置 Nginx**：
    将生成的 `dist` 文件夹内容上传至服务器目录（如 `/var/www/materialflow`），并配置 `nginx.conf`：
    ```nginx
    server {
        listen 80;
        server_name your-domain.com;

        location / {
            root /var/www/materialflow;
            index index.html;
            try_files $uri $uri/ /index.html;
        }
    }
    ```
3.  **重启 Nginx**：
    ```bash
    sudo nginx -s reload
    ```

### 方式二：Docker 容器化部署 (推荐)

如果您希望在私有云环境快速启动，推荐使用 Docker。

1.  **编写 Dockerfile**：
    在根目录创建 `Dockerfile`：
    ```dockerfile
    # 使用 node 镜像进行构建
    FROM node:20-alpine as build-stage
    WORKDIR /app
    COPY package*.json ./
    RUN npm install
    COPY . .
    RUN npm run build

    # 使用 nginx 镜像进行分发
    FROM nginx:stable-alpine as production-stage
    COPY --from=build-stage /app/dist /usr/share/nginx/html
    EXPOSE 80
    CMD ["nginx", "-g", "daemon off;"]
    ```
2.  **构建并运行**：
    ```bash
    docker build -t materialflow-pro .
    docker run -d -p 8080:80 --name mf-system materialflow-pro
    ```
    访问地址：`http://服务器IP:8080`

### 方式三：关于 SQLite 后端私有化

如果需要将数据保存到物理 SQLite 文件（实现真正的逻辑分离）：
1.  **准备后端**：您需要一个轻量级的 Node.js/Express 或 Python/FastAPI 后端。
2.  **数据库连接**：将 `services/db.ts` 中的 LocalStorage 操作替换为对应的 API 请求。
3.  **私有化运行**：在内网服务器同时启动前端 Nginx 和后端 Service，并确保前端可以访问后端的 API 端口。

## 默认账户
*   **用户名**：`admin`
*   **密码**：`admin`

---
*注意：在生产环境部署时，请务必修改默认密码并启用 HTTPS 协议以确保数据传输安全。*
