# WebCrawl 单体仓库

WebCrawl 是一个轻量的自托管页面抓取服务，支持可选的 Playwright 渲染，
并提供现代化的 React Demo 用于测试抓取结果。

## 应用列表

- `apps/WebCrawl`: 核心 API 服务（Bun + Elysia）
- `apps/playwright-service-ts`: 可选 Playwright 微服务
- `apps/webcrawl-demo`: React + Tailwind Demo 控制台

## 共享包

- `packages/firecrawl-rs`: 本地 N-API 原生模块

## 环境要求

- Node.js 18+（或使用 Bun）
- 包管理器（bun、pnpm、npm 或 yarn）

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

也可以改用 `bun install`、`npm install` 或 `yarn install`。

## 启动方式

启动 API 服务：

```bash
cd apps/WebCrawl
bun run dev
```

启动 Playwright 微服务（可选）：

```bash
cd apps/playwright-service-ts
pnpm run dev
```

启动 Demo 前端：

```bash
cd apps/webcrawl-demo
pnpm run dev
```

Demo 运行在 `http://localhost:5174`，并通过 `/api` 代理到
`http://localhost:3002`。

## API

`POST /scrape`

```json
{
  "url": "https://example.com",
  "formats": [{ "type": "markdown" }, { "type": "links" }],
  "onlyMainContent": true
}
```

## 配置

常用环境变量：

- `HOST`, `PORT`: API 服务监听地址与端口。
- `LOGGING_LEVEL`: Winston 日志级别。
- `PLAYWRIGHT_MICROSERVICE_URL`: 开启 Playwright 渲染。
- `PROXY_SERVER`, `PROXY_USERNAME`, `PROXY_PASSWORD`: 出站代理。
- `EXPOSE_ERROR_DETAILS`, `EXPOSE_ERROR_STACK`: 输出详细错误信息。

完整列表见 `apps/WebCrawl/.env.example`。

## 项目结构

- 根目录 `package.json` 声明 `apps/*` 工作区。
- 根目录 `tsconfig.json` 提供共享的 TypeScript 默认配置。
- 各应用 `tsconfig.json` 继承根配置。
