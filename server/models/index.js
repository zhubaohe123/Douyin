import Video from './Video.js';
import Comment from './Comment.js';
import CrawlTask from './CrawlTask.js';

// ========== 定义模型关联 ==========

// 视频 -> 评论 (一对多，通过 aweme_id 关联)
Video.hasMany(Comment, {
  foreignKey: 'aweme_id',
  sourceKey: 'aweme_id',
  as: 'comments',
  constraints: false, // 不创建外键约束，提高批量写入性能
});
Comment.belongsTo(Video, {
  foreignKey: 'aweme_id',
  targetKey: 'aweme_id',
  as: 'video',
  constraints: false,
});

// 采集任务 -> 评论 (一对多)
CrawlTask.hasMany(Comment, {
  foreignKey: 'crawl_task_id',
  as: 'comments',
  constraints: false,
});
Comment.belongsTo(CrawlTask, {
  foreignKey: 'crawl_task_id',
  as: 'crawlTask',
  constraints: false,
});

export { Video, Comment, CrawlTask };
