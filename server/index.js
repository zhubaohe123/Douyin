import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import sequelize, { testConnection } from './db.js';

// 导入路由
import syncRoutes from './routes/sync.js';
import commentsRoutes from './routes/comments.js';
import videosRoutes from './routes/videos.js';
import tasksRoutes from './routes/tasks.js';
import tikhubRoutes from './routes/tikhub.js';

// 导入模型（触发关联定义）
import './models/index.js';

const app = express();
const PORT = parseInt(process.env.SERVER_PORT, 10) || 3001;

// ========== 中间件 ==========

// CORS - 允许前端跨域访问
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 响应压缩
app.use(compression());

// JSON 请求体解析（50MB 上限，支持大批量评论提交）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========== 挂载路由 ==========
app.use(syncRoutes);
app.use(commentsRoutes);
app.use(videosRoutes);
app.use(tasksRoutes);
app.use(tikhubRoutes);

// 健康检查
app.get('/api/db/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use('/api/db/*', (req, res) => {
  res.status(404).json({ error: '接口不存在', path: req.originalUrl });
});

// ========== 启动服务 ==========
async function startServer() {
  try {
    // 测试数据库连接
    await testConnection();

    // 同步数据库表结构（开发模式使用 alter）
    await sequelize.sync({ alter: true });
    console.log('✅ 数据库表结构同步完成');

    // 启动 HTTP 服务
    app.listen(PORT, () => {
      console.log('');
      console.log('🚀 ============================================');
      console.log(`🚀  抖音评论采集后端服务已启动`);
      console.log(`🚀  地址: http://localhost:${PORT}`);
      console.log(`🚀  API 前缀: /api/db/`);
      console.log('🚀 ============================================');
      console.log('');
      console.log('📌 可用接口:');
      console.log(`   POST   /api/db/sync/comments    - 同步评论数据`);
      console.log(`   GET    /api/db/comments          - 查询评论列表`);
      console.log(`   GET    /api/db/comments/search   - 全文搜索评论`);
      console.log(`   GET    /api/db/comments/stats    - 评论统计`);
      console.log(`   DELETE /api/db/comments/:cid     - 删除评论`);
      console.log(`   GET    /api/db/videos            - 视频列表`);
      console.log(`   GET    /api/db/tasks             - 任务列表`);
      console.log(`   GET    /api/db/tasks/:id         - 任务详情`);
      console.log(`   GET    /api/db/health            - 健康检查`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ 服务启动失败:', error);
    process.exit(1);
  }
}

startServer();
