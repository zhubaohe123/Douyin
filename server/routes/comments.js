import { Router } from 'express';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../db.js';
import { Comment, Video } from '../models/index.js';

const router = Router();

/**
 * GET /api/db/comments
 * 分页查询评论列表，支持多种筛选条件
 * 
 * Query Params:
 *   aweme_id   - 按视频ID筛选
 *   ip_label   - 按IP属地筛选
 *   start_date - 起始时间戳（Unix秒）
 *   end_date   - 结束时间戳（Unix秒）
 *   sort       - 排序字段: digg_count | create_time（默认 create_time）
 *   order      - 排序方向: asc | desc（默认 desc）
 *   page       - 页码（默认 1）
 *   size       - 每页条数（默认 20）
 */
router.get('/api/db/comments', async (req, res) => {
  try {
    const {
      aweme_id,
      ip_label,
      start_date,
      end_date,
      is_marked,
      sort = 'create_time',
      order = 'desc',
      page = 1,
      size = 20,
    } = req.query;

    const where = {};

    if (aweme_id) {
      where.aweme_id = aweme_id;
    }
    if (ip_label) {
      where.ip_label = ip_label;
    }
    if (is_marked !== undefined) {
      where.is_marked = is_marked === 'true' || is_marked === '1' || is_marked === true;
    }
    if (start_date || end_date) {
      where.create_time = {};
      if (start_date) where.create_time[Op.gte] = parseInt(start_date, 10);
      if (end_date) where.create_time[Op.lte] = parseInt(end_date, 10);
    }

    // 安全校验排序字段
    const allowedSort = ['digg_count', 'create_time', 'created_at'];
    const sortField = allowedSort.includes(sort) ? sort : 'create_time';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(size, 10) || 20));
    const offset = (pageNum - 1) * pageSize;

    const { count, rows } = await Comment.findAndCountAll({
      where,
      include: [
        {
          model: Video,
          as: 'video',
          attributes: ['title'],
        }
      ],
      order: [[sortField, sortOrder]],
      limit: pageSize,
      offset,
    });

    res.json({
      success: true,
      data: {
        total: count,
        page: pageNum,
        size: pageSize,
        total_pages: Math.ceil(count / pageSize),
        list: rows,
      },
    });
  } catch (error) {
    console.error('❌ 查询评论列表失败:', error);
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

/**
 * GET /api/db/comments/search
 * 全文搜索评论（使用 MATCH AGAINST + ngram 解析器）
 * 
 * Query Params:
 *   q        - 搜索关键词（必填）
 *   aweme_id - 可选，限定视频范围
 *   page     - 页码（默认 1）
 *   size     - 每页条数（默认 20）
 */
router.get('/api/db/comments/search', async (req, res) => {
  try {
    const { q, aweme_id, is_marked, page = 1, size = 20 } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: '缺少搜索关键词 q' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(size, 10) || 20));
    const offset = (pageNum - 1) * pageSize;

    const searchQuery = q.trim();

    // 构建 WHERE 条件
    let whereClause = 'WHERE MATCH(text) AGAINST(:q IN BOOLEAN MODE)';
    const replacements = { q: searchQuery, limit: pageSize, offset };

    if (aweme_id) {
      whereClause += ' AND aweme_id = :aweme_id';
      replacements.aweme_id = aweme_id;
    }

    if (is_marked !== undefined) {
      const isMarkedVal = is_marked === 'true' || is_marked === '1' || is_marked === true;
      whereClause += ' AND is_marked = :is_marked';
      replacements.is_marked = isMarkedVal ? 1 : 0;
    }

    // 查询总数
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM comments ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    );
    const total = countResult.total;

    // 查询数据
    const results = await sequelize.query(
      `SELECT c.*, v.title as video_title 
       FROM comments c
       LEFT JOIN videos v ON c.aweme_id = v.aweme_id
       ${whereClause} 
       ORDER BY c.digg_count DESC LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: {
        total,
        page: pageNum,
        size: pageSize,
        total_pages: Math.ceil(total / pageSize),
        list: results,
      },
    });
  } catch (error) {
    console.error('❌ 全文搜索失败:', error);
    res.status(500).json({ error: '搜索失败', message: error.message });
  }
});

/**
 * GET /api/db/comments/stats
 * 评论统计数据
 * 返回：总数、IP属地分布 Top10、最高赞评论 Top10、日期分布
 */
router.get('/api/db/comments/stats', async (req, res) => {
  try {
    const { aweme_id } = req.query;
    const whereClause = aweme_id ? 'WHERE aweme_id = :aweme_id' : '';
    const replacements = aweme_id ? { aweme_id } : {};

    // 1. 评论总数
    const [totalResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM comments ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 2. IP属地分布 Top 10
    const ipDistribution = await sequelize.query(
      `SELECT ip_label, COUNT(*) as count 
       FROM comments 
       ${whereClause ? whereClause + ' AND' : 'WHERE'} ip_label IS NOT NULL AND ip_label != ''
       GROUP BY ip_label 
       ORDER BY count DESC 
       LIMIT 10`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 3. 最高赞评论 Top 10
    const topLiked = await sequelize.query(
      `SELECT cid, aweme_id, user_nickname, text, digg_count, ip_label, create_time 
       FROM comments 
       ${whereClause}
       ORDER BY digg_count DESC 
       LIMIT 10`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 4. 日期分布（按天统计）
    const dateDistribution = await sequelize.query(
      `SELECT DATE(FROM_UNIXTIME(create_time)) as date, COUNT(*) as count 
       FROM comments 
       ${whereClause ? whereClause + ' AND' : 'WHERE'} create_time IS NOT NULL AND create_time > 0
       GROUP BY date 
       ORDER BY date DESC 
       LIMIT 30`,
      { replacements, type: QueryTypes.SELECT }
    );

    // 5. 总视频数
    const [videoCountResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM videos`,
      { type: QueryTypes.SELECT }
    );

    // 6. 总点赞数
    const [likesResult] = await sequelize.query(
      `SELECT COALESCE(SUM(digg_count), 0) as total FROM comments ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: {
        total: totalResult.total,
        total_videos: videoCountResult.total,
        total_likes: likesResult.total,
        ip_distribution: ipDistribution,
        top_liked: topLiked,
        date_distribution: dateDistribution,
      },
    });
  } catch (error) {
    console.error('❌ 统计查询失败:', error);
    res.status(500).json({ error: '统计查询失败', message: error.message });
  }
});

/**
 * DELETE /api/db/comments/:cid
 * 根据抖音原生评论ID删除评论
 */
router.delete('/api/db/comments/:cid', async (req, res) => {
  try {
    const { cid } = req.params;

    const deleted = await Comment.destroy({
      where: { cid },
    });

    if (deleted === 0) {
      return res.status(404).json({ error: '评论不存在', cid });
    }

    res.json({
      success: true,
      message: '评论已删除',
      cid,
    });
  } catch (error) {
    console.error('❌ 删除评论失败:', error);
    res.status(500).json({ error: '删除失败', message: error.message });
  }
});

/**
 * PUT /api/db/comments/:cid/toggle-mark
 * 切换评论的标记状态（重要/收藏）
 */
router.put('/api/db/comments/:cid/toggle-mark', async (req, res) => {
  try {
    const { cid } = req.params;

    const comment = await Comment.findOne({ where: { cid } });

    if (!comment) {
      return res.status(404).json({ error: '评论不存在', cid });
    }

    const newMarkedState = !comment.is_marked;
    await Comment.update(
      { is_marked: newMarkedState },
      { where: { cid } }
    );

    res.json({
      success: true,
      message: newMarkedState ? '评论已标记' : '已取消标记',
      cid,
      is_marked: newMarkedState,
    });
  } catch (error) {
    console.error('❌ 切换评论标记状态失败:', error);
    res.status(500).json({ error: '操作失败', message: error.message });
  }
});

export default router;
