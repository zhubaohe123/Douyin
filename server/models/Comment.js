import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

// 评论表
const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  cid: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '抖音原生评论ID，用于去重',
  },
  aweme_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '所属视频ID',
  },
  parent_comment_id: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '父评论ID（二级评论时有值）',
  },
  user_nickname: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '评论者昵称',
  },
  user_id: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '评论者用户ID',
  },
  user_avatar: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '评论者头像URL',
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '评论内容',
  },
  digg_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '点赞数',
  },
  reply_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '回复数',
  },
  ip_label: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'IP属地',
  },
  create_time: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: '评论创建时间（Unix时间戳）',
  },
  crawl_task_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    comment: '关联的采集任务ID',
  },
}, {
  tableName: 'comments',
  timestamps: true,
  updatedAt: false, // 评论只有创建时间，不需要更新时间
  indexes: [
    { fields: ['aweme_id'] },
    { fields: ['parent_comment_id'] },
    { fields: ['digg_count'] },
    { fields: ['ip_label'] },
    { fields: ['create_time'] },
    { fields: ['crawl_task_id'] },
    // FULLTEXT 索引需要在 sync 后通过原始 SQL 创建
  ],
});

// sync 后创建 FULLTEXT 索引（使用 ngram 解析器支持中文搜索）
Comment.afterSync(async () => {
  try {
    // 检查 FULLTEXT 索引是否已存在
    const [results] = await sequelize.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'comments' 
       AND INDEX_NAME = 'ft_comments_text'`
    );
    if (results.length === 0) {
      await sequelize.query(
        `ALTER TABLE comments ADD FULLTEXT INDEX ft_comments_text (text) WITH PARSER ngram`
      );
      console.log('✅ FULLTEXT 索引创建成功');
    }
  } catch (error) {
    // 如果索引已存在或其他非致命错误，打印警告继续运行
    console.warn('⚠️  FULLTEXT 索引创建跳过:', error.message);
  }
});

export default Comment;
