import { Router } from 'express';
import { CrawlTask } from '../models/index.js';

const router = Router();

/**
 * GET /api/db/tasks
 * 获取所有采集任务列表，按开始时间倒序
 */
router.get('/api/db/tasks', async (req, res) => {
  try {
    const tasks = await CrawlTask.findAll({
      order: [['started_at', 'DESC']],
    });

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('❌ 查询任务列表失败:', error);
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

/**
 * GET /api/db/tasks/:id
 * 获取单个任务详情
 */
router.get('/api/db/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const task = await CrawlTask.findByPk(id);

    if (!task) {
      return res.status(404).json({ error: '任务不存在', id });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('❌ 查询任务详情失败:', error);
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

export default router;
