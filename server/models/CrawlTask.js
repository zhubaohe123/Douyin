import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

// 采集任务表
const CrawlTask = sequelize.define('CrawlTask', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  task_type: {
    type: DataTypes.ENUM('links', 'search'),
    allowNull: false,
    comment: '任务类型：links=链接采集, search=搜索采集',
  },
  input_source: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '输入源（链接列表或搜索关键词）',
  },
  keyword_filter: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '关键词过滤条件',
  },
  video_filter: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '视频过滤条件',
  },
  total_videos: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '采集视频总数',
  },
  total_comments: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '采集评论总数',
  },
  status: {
    type: DataTypes.ENUM('running', 'completed', 'failed', 'stopped'),
    defaultValue: 'running',
    comment: '任务状态',
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '任务开始时间',
  },
  finished_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '任务结束时间',
  },
}, {
  tableName: 'crawl_tasks',
  timestamps: true,
});

export default CrawlTask;
