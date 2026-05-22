import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

// 视频信息表
const Video = sequelize.define('Video', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  aweme_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: '抖音视频ID',
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '视频标题',
  },
  cover_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '封面图URL',
  },
  author_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '作者昵称',
  },
  author_avatar: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '作者头像URL',
  },
  likes: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '点赞数',
  },
  comments_count: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '评论数',
  },
  shares: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '分享数',
  },
  collects: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '收藏数',
  },
}, {
  tableName: 'videos',
  timestamps: true,
});

export default Video;
