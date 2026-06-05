# 抖音评论采集与分析平台

这是一个基于 **React + Vite + Express + MySQL** 的抖音评论采集、管理与可视化分析平台，配套一个用于页面内评论定位的浏览器扩展。项目聚焦于批量抓取视频评论、结构化入库、检索筛选、统计分析和数据导出。

> 重要提示：本项目仅用于学习、研究和技术交流，请在遵守抖音平台规则、当地法律法规以及相关服务条款的前提下使用，不得用于任何商业用途或侵犯第三方权益的行为。

## 项目亮点

- 支持批量导入抖音视频链接或作者主页链接
- 支持 TikHub / douyin.wtf 等第三方评论接口切换
- 评论数据持久化到 MySQL，并提供任务管理能力
- 前端内置关键词搜索、排序、筛选、分页和标记收藏
- 支持导出 Excel，方便后续归档和分析
- 提供评论统计、趋势图、点赞分布等可视化图表
- 配套浏览器扩展，可在抖音页面内快速定位评论位置
- 前后端分离，扩展性较好，便于二次开发

## 系统架构

`mermaid
flowchart LR
  A[前端 React + Vite] --> B[评论采集与任务调度]
  B --> C[TikHub / douyin.wtf 接口]
  B --> D[本地 Playwright 搜索能力]
  A --> E[Express API 服务]
  E --> F[(MySQL)]
  G[Chrome 扩展] --> H[抖音网页]
  G --> A
`

前端负责用户交互与数据展示；后端负责任务入库、评论查询、统计接口和数据持久化；浏览器扩展负责在抖音页面内辅助定位与采集体验。

## 功能说明

### 前端能力

- 批量输入链接并启动采集任务
- 按作者主页抓取视频列表后继续抓取评论
- 评论列表支持搜索、时间/点赞排序、筛选和分页
- 支持收藏标记，方便后续快速定位重点评论
- 支持导出评论数据为 Excel 文件
- 提供评论统计与可视化图表

### 后端能力

- POST /api/db/sync/comments：同步评论数据
- GET /api/db/comments：查询评论列表
- GET /api/db/comments/search：评论全文搜索
- GET /api/db/comments/stats：评论统计信息
- DELETE /api/db/comments/:cid：删除指定评论
- GET /api/db/videos：查询视频列表
- GET /api/db/tasks：查询任务列表
- GET /api/db/tasks/:id：查询任务详情
- GET /api/db/health：后端健康检查

### 浏览器扩展

扩展位于 chrome-extension/ 目录，主要能力包括：

- 在抖音相关页面配合采集系统使用
- 辅助评论定位与页面交互
- 通过本地服务和页面脚本协同工作

## 技术栈

- 前端：React、Vite、Chart.js、react-chartjs-2、lucide-react、xlsx
- 后端：Express、Sequelize、MySQL2、dotenv、cors、compression
- 工具链：ESLint、Nodemon
- 采集能力：支持 TikHub / douyin.wtf 接口，以及本地 Playwright 搜索接口

## 目录结构

`	ext
.
├─ chrome-extension/         # 浏览器扩展
├─ public/                   # 前端静态资源
├─ server/                   # Express 后端服务
│  ├─ models/                # Sequelize 数据模型
│  └─ routes/                # API 路由
├─ src/                      # 前端 React 代码
├─ index.html
├─ package.json
├─ README.md
└─ LICENSE
`

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 8+（或兼容版本）
- npm 或 pnpm
- Chrome（用于加载浏览器扩展）

### 1. 克隆仓库

`ash
git clone https://github.com/zhubaohe123/Douyin.git
cd Douyin
`

### 2. 启动后端服务

`ash
cd server
cp .env.example .env
# 根据本地环境修改数据库配置和端口
npm install
npm run dev
`

默认健康检查接口：

`ash
curl http://localhost:3001/api/db/health
`

### 3. 启动前端服务

`ash
cd ..
npm install
npm run dev
`

默认情况下，前端会启动 Vite 开发服务器，并通过代理将部分 API 请求转发到后端服务。

### 4. 使用浏览器扩展

1. 打开 Chrome，进入 chrome://extensions
2. 开启「开发者模式」
3. 选择「加载已解压的扩展程序」
4. 选择 chrome-extension/ 目录

## 配置说明

- 前端部分配置项保存在浏览器 localStorage，例如评论接口类型、接口地址和 Token
- 后端服务配置位于 server/.env，请参考 server/.env.example 进行修改
- ite.config.js 中包含开发代理配置，可按需调整后端地址

## 使用建议

- 建议先从少量链接开始测试，再逐步扩大抓取规模
- 遇到接口失败时，可先检查 Token、接口地址和网络环境
- 建议将重点评论收藏后导出，便于后续处理
- 如用于学习研究，建议结合统计结果做内容理解，而非盲目批量采集

## 免责声明

- 本项目仅供学习研究和技术交流使用
- 使用本项目所产生的一切风险由使用者自行承担
- 请遵守平台规则和相关法律法规，不得进行任何违规操作
- 如有侵权或违规，请联系删除

## 开源协议

本项目基于 **MIT License** 开源，详见仓库中的 [LICENSE](./LICENSE) 文件。
