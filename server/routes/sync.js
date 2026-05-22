import { Router } from 'express';
import { Video, Comment, CrawlTask } from '../models/index.js';

const router = Router();

/**
 * POST /api/db/sync/comments
 * 同步评论数据：upsert 视频信息，批量插入评论（INSERT IGNORE 去重），更新任务状态
 * 
 * Request Body:
 * {
 *   video: { aweme_id, title, cover_url, author_name, author_avatar, likes, comments_count, shares, collects },
 *   comments: [{ cid, aweme_id, parent_comment_id, user_nickname, user_id, user_avatar, text, digg_count, reply_count, ip_label, create_time }],
 *   task: { id?, task_type, input_source, keyword_filter, video_filter, total_videos, total_comments, status, started_at, finished_at }
 * }
 */
router.post('/api/db/sync/comments', async (req, res) => {
  try {
    const { video, videos, comments, task } = req.body;

    if (!comments || !Array.isArray(comments)) {
      return res.status(400).json({ error: '缺少 comments 数组' });
    }

    let videoRecord = null;
    let taskRecord = null;

    // 1. Upsert 视频信息（支持单视频及多视频一键保存）
    if (videos && Array.isArray(videos) && videos.length > 0) {
      for (const v of videos) {
        if (v && v.aweme_id) {
          const [record] = await Video.upsert({
            aweme_id: String(v.aweme_id),
            title: v.title || null,
            cover_url: v.cover_url || null,
            author_name: v.author_name || null,
            author_avatar: v.author_avatar || null,
            likes: v.likes || 0,
            comments_count: v.comments_count || 0,
            shares: v.shares || 0,
            collects: v.collects || 0,
          });
          if (!videoRecord) videoRecord = record; // 保持响应兼容，默认指向首个视频
        }
      }
    } else if (video && video.aweme_id) {
      [videoRecord] = await Video.upsert({
        aweme_id: String(video.aweme_id),
        title: video.title || null,
        cover_url: video.cover_url || null,
        author_name: video.author_name || null,
        author_avatar: video.author_avatar || null,
        likes: video.likes || 0,
        comments_count: video.comments_count || 0,
        shares: video.shares || 0,
        collects: video.collects || 0,
      });
    }

    // 2. 创建或更新采集任务
    if (task) {
      if (task.id) {
        // 更新已有任务
        await CrawlTask.update({
          total_videos: task.total_videos,
          total_comments: task.total_comments,
          status: task.status,
          finished_at: task.finished_at || null,
        }, {
          where: { id: task.id },
        });
        taskRecord = await CrawlTask.findByPk(task.id);
      } else {
        // 创建新任务
        taskRecord = await CrawlTask.create({
          task_type: task.task_type || 'links',
          input_source: task.input_source || null,
          keyword_filter: task.keyword_filter || null,
          video_filter: task.video_filter || null,
          total_videos: task.total_videos || 0,
          total_comments: task.total_comments || 0,
          status: task.status || 'running',
          started_at: task.started_at || new Date(),
          finished_at: task.finished_at || null,
        });
      }
    }

    // 3. 批量插入评论（INSERT IGNORE 去重，基于 cid 唯一索引）
    let insertedCount = 0;
    if (comments.length > 0) {
      const commentData = comments.map(c => ({
        cid: c.cid,
        aweme_id: c.aweme_id || (video ? video.aweme_id : null),
        parent_comment_id: c.parent_comment_id || null,
        user_nickname: c.user_nickname || null,
        user_id: c.user_id || null,
        user_avatar: c.user_avatar || null,
        text: c.text || '',
        digg_count: c.digg_count || 0,
        reply_count: c.reply_count || 0,
        ip_label: c.ip_label || null,
        create_time: c.create_time || null,
        crawl_task_id: taskRecord ? taskRecord.id : (c.crawl_task_id || null),
        is_marked: c.is_marked || false,
      }));

      // ignoreDuplicates 对应 INSERT IGNORE
      const result = await Comment.bulkCreate(commentData, {
        ignoreDuplicates: true,
        // 不需要返回记录，提高性能
        returning: false,
      });
      insertedCount = result.length;
    }

    res.json({
      success: true,
      data: {
        video_id: videoRecord ? videoRecord.aweme_id : null,
        task_id: taskRecord ? taskRecord.id : null,
        comments_received: comments.length,
        comments_inserted: insertedCount,
      },
    });
  } catch (error) {
    console.error('❌ 同步评论数据失败:', error);
    res.status(500).json({
      error: '同步数据失败',
      message: error.message,
    });
  }
});

export default router;
