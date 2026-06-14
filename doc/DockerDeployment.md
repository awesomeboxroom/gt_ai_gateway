# Docker 部署文档

本文档描述如何使用 Docker 部署 serverless-ai-gateway。

---

## 1. 拉取镜像

本项目推荐使用 GitHub Container Registry (ghcr.io) 提供的官方镜像：

```bash
docker pull ghcr.io/alexazhou/gt_ai_gateway:latest
```

## 2. 启动容器

直接使用 `docker run` 启动服务：

```bash
docker run -d \
    --name gt_ai_gateway \
    -p 8787:8787 \
    -v $(pwd)/data:/app/data \
    -e ROOT_TOKEN=your-secret-root-token \
    ghcr.io/alexazhou/gt_ai_gateway:latest
```

> **注意**：`ROOT_TOKEN` 是系统最高权限 Token，用于登录管理后台。请务必将其修改为强密码。

服务启动后，访问 `http://localhost:8787` 即可登录进入管理后台。

### 数据持久化说明

服务使用单个挂载目录来持久化所有数据：

| 宿主机目录 | 容器目录 | 说明 |
|-----------|---------|------|
| `./data` | `/app/data` | 存放 SQLite 数据库文件和每日应用日志 |

日志文件会自动写入到宿主机的 `./data/log` 目录下，按日期命名（如 `app-2026-03-16.log`）。

---

## 3. 常用操作

```bash
# 实时查看系统运行日志
docker logs -f gt_ai_gateway

# 停止服务容器
docker stop gt_ai_gateway

# 重新启动服务容器
docker start gt_ai_gateway

# 删除容器（不会删除 ./data 挂载目录下的数据）
docker rm -f gt_ai_gateway
```

### 数据库维护工具 (进阶)

如果您需要直接在容器内执行数据库状态检查或升级等维护命令：

```bash
# 检查数据库状态
docker exec -it gt_ai_gateway npx tsx script/db.ts status --env node

# 强制执行数据库表结构升级（通常容器启动时会自动执行，无需手动调用）
docker exec -it gt_ai_gateway npm run db:migrate:node
```

---

## Dockerfile 说明

项目采用多阶段构建优化镜像大小：

1. **构建阶段** (`builder`)：
   - 安装前端和后端依赖
   - 构建前端静态资源

2. **生产阶段**：
   - 只复制必要的运行时文件
   - 安装 `libstdc++` 以支持 `better-sqlite3`
   - 创建日志和数据目录

### 镜像信息

| 配置项 | 值 |
|-------|-----|
| 基础镜像 | `node:20-alpine` |
| 暴露端口 | `8787` |
| 数据库路径 | `/app/data/local.db` |
| 日志路径 | `/app/data/log`（Docker 镜像内置默认值） |
| 健康检查 | 每 30 秒检查 `/welcome` 端点 |

---

## 健康检查

容器内置健康检查机制：

- **检查间隔**：30 秒
- **超时时间**：3 秒
- **重试次数**：3 次
- **检查端点**：`http://localhost:8787/welcome`

可以通过以下命令查看健康状态：

```bash
docker inspect --format='{{.State.Health.Status}}' gt_ai_gateway
```

---

## 故障排查

### 容器无法启动

```bash
# 查看容器日志
docker logs gt_ai_gateway

# 进入容器排查
docker exec -it gt_ai_gateway sh
```

### 数据库初始化失败

确保 `./data` 目录有写权限：

```bash
chmod 755 ./data
```

### 日志未写入

检查宿主机 `./data` 目录是否有写权限（日志会写入到 `./data/log` 子目录）：

```bash
chmod 755 ./data
```

---

## 相关文档

- **后端开发手册**：`doc/BackendDevManual.md`
- **前端开发手册**：`doc/FrontendDevManual.md`
- **LLM API 使用指南**：`doc/LlmApiUsage.md`
