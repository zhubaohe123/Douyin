import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../db.js';
import { Video } from '../models/index.js';

const router = Router();

/**
 * GET /api/db/videos
 * 获取视频列表，附带评论数，按更新时间倒序
 */
router.get('/api/db/videos', async (req, res) => {
  try {
    // 自动修复：检查 comments 表中是否有 aweme_id 但在 videos 表中没有的记录，自动补全占位视频数据
    const [missingVideos] = await sequelize.query(
      `SELECT DISTINCT c.aweme_id 
       FROM comments c
       LEFT JOIN videos v ON c.aweme_id = v.aweme_id
       WHERE v.aweme_id IS NULL AND c.aweme_id IS NOT NULL AND c.aweme_id != ''`
    );

    if (missingVideos.length > 0) {
      console.log(`🔧 发现 ${missingVideos.length} 个视频在 comments 中存在但 videos 表中缺失，正在自动生成占位记录进行修复...`);
      const newVideoRecords = missingVideos.map(mv => ({
        aweme_id: String(mv.aweme_id),
        title: `视频作品 #${mv.aweme_id}`,
        cover_url: '',
        author_name: '已归档视频',
        author_avatar: '',
        likes: 0,
        comments_count: 0,
        shares: 0,
        collects: 0,
        created_at: new Date(),
        updated_at: new Date()
      }));
      // 批量插入占位符
      await Video.bulkCreate(newVideoRecords, { ignoreDuplicates: true });
    }

    // 使用子查询获取实际评论数（数据库中的真实条数）
    const videos = await sequelize.query(
      `SELECT v.*, 
              COALESCE(c.real_comment_count, 0) as real_comment_count
       FROM videos v
       LEFT JOIN (
         SELECT aweme_id, COUNT(*) as real_comment_count 
         FROM comments 
         GROUP BY aweme_id
       ) c ON v.aweme_id = c.aweme_id
       ORDER BY v.updated_at DESC`,
      { type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: videos,
    });
  } catch (error) {
    console.error('❌ 查询视频列表失败:', error);
    res.status(500).json({ error: '查询失败', message: error.message });
  }
});

export default router;
