import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Download, 
  Play, 
  MessageSquare, 
  ThumbsUp, 
  MapPin, 
  Clock, 
  BarChart2, 
  Video, 
  User, 
  AlertCircle, 
  HelpCircle, 
  Info,
  Layers,
  TrendingUp,
  FileText,
  FileSpreadsheet,
  X,
  RotateCcw,
  Filter,
  Database,
  Save,
  ChevronLeft,
  ChevronRight,
  Loader2,
  History,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './App.css';

function App() {
  // Input & Crawl Configuration State
  const [inputUrls, setInputUrls] = useState('');
  const [awemeId, setAwemeId] = useState('');
  const [maxComments, setMaxComments] = useState(200);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [videoKeywordFilter, setVideoKeywordFilter] = useState('');
  const [profileVideoLimit, setProfileVideoLimit] = useState(20);

  // 自定义 Playwright 搜索 API 配置状态
  const [crawlMode, setCrawlMode] = useState('links'); // 'links' or 'search'
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchApiUrl, setSearchApiUrl] = useState('http://localhost:8000');
  const [searchPages, setSearchPages] = useState(1); // 1 to 5 pages
  
  // 评论 API 接口配置状态 (本地默认 / TikHub 开发者)
  const [commentApiType, setCommentApiType] = useState(() => localStorage.getItem('comment_api_type') || 'tikhub');
  const [tikhubToken, setTikhubToken] = useState(() => localStorage.getItem('tikhub_token') || 'pawjW+xB3VyVu2qKOY+67w7nB2XWB5pF4DiA7U6hR8GXj2mwK0yeWAudDQ==');
  const [tikhubApiUrl, setTikhubApiUrl] = useState(() => localStorage.getItem('tikhub_api_url') || 'https://api.tikhub.dev');

  // Crawler Execution State
  const [isCrawling, setIsCrawling] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [fetchedCount, setFetchedCount] = useState(0);
  const [totalEstimated, setTotalEstimated] = useState(0);
  const [percentProgress, setPercentProgress] = useState(0);
  const [concurrency, setConcurrency] = useState(2);
  const [activeWorkers, setActiveWorkers] = useState([]);

  // Data State
  const [videoInfo, setVideoInfo] = useState(null);
  const [crawledVideosMap, setCrawledVideosMap] = useState({});
  const [comments, setComments] = useState([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState('comments');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('likes'); // 'likes' or 'time'
  const [notification, setNotification] = useState(null);
  const [hasExtension, setHasExtension] = useState(false);

  // 持久化保存评论 API 配置
  useEffect(() => {
    localStorage.setItem('comment_api_type', commentApiType);
  }, [commentApiType]);

  useEffect(() => {
    localStorage.setItem('tikhub_token', tikhubToken);
  }, [tikhubToken]);

  useEffect(() => {
    localStorage.setItem('tikhub_api_url', tikhubApiUrl);
  }, [tikhubApiUrl]);
  
  // Database State
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [dbSaveResult, setDbSaveResult] = useState(null);
  const [dbActiveTab, setDbActiveTab] = useState('search'); // 'search' or 'history'
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbSearchIp, setDbSearchIp] = useState('');
  const [dbSearchVideoId, setDbSearchVideoId] = useState('');
  const [dbComments, setDbComments] = useState([]);
  const [dbTotalCount, setDbTotalCount] = useState(0);
  const [dbPage, setDbPage] = useState(1);
  const [dbPageSize] = useState(50);
  const [dbIsLoading, setDbIsLoading] = useState(false);
  const [dbSortOrder, setDbSortOrder] = useState('digg_count');
  const [dbVideos, setDbVideos] = useState([]);
  const [dbTasks, setDbTasks] = useState([]);
  const [dbStats, setDbStats] = useState(null);

  // Refs to control crawling loops
  const crawlActiveRef = useRef(false);

  // Auto-dismiss notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // 监听并对接谷歌浏览器助手插件 (Chrome Extension Handshake & Detect)
  useEffect(() => {
    // 1. 首次载入主动检测全局变量与 DOM 属性标记
    if (window.__DOUYIN_COLLECTOR_EXTENSION_INSTALLED__ || 
        document.documentElement.dataset.douyinCollectorInstalled === 'true') {
      setHasExtension(true);
    }

    // 2. 接收来自插件 Content Script 的主动握手通知
    const handleExtensionReady = (e) => {
      setHasExtension(true);
      showNotification('已成功对接抖音评论采集助手插件 🔌', 'success');
    };

    window.addEventListener('DOUYIN_COLLECTOR_EXT_READY', handleExtensionReady);

    // 3. 高频轮询补偿检测（确保插件稍微延迟注入时也能无缝捕获）
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      if (window.__DOUYIN_COLLECTOR_EXTENSION_INSTALLED__ || 
          document.documentElement.dataset.douyinCollectorInstalled === 'true') {
        setHasExtension(true);
        clearInterval(checkInterval);
      }
      if (checkCount >= 5) {
        clearInterval(checkInterval);
      }
    }, 1000);

    return () => {
      window.removeEventListener('DOUYIN_COLLECTOR_EXT_READY', handleExtensionReady);
      clearInterval(checkInterval);
    };
  }, []);

  // 触发定位事件，向浏览器助手插件广播跳转载荷
  const handleJumpToComment = (c, parentVideoId = null) => {
    const videoId = parentVideoId || c.video_id || c.aweme_id;
    if (!videoId) return;

    const payload = {
      videoId: videoId,
      commentId: String(c.cid),
      nickname: c.user?.nickname || c.user_nickname || '未知用户',
      text: c.text || '',
      parentId: c.reply_id || c.parent_comment_id || null,
      timestamp: Date.now()
    };

    // 1. 派发 CustomEvent 事件，以便页面注入的插件脚本拦截并转发给 background.js
    const extEvent = new CustomEvent('DOUYIN_COLLECTOR_JUMP_COMMENT', { detail: payload });
    window.dispatchEvent(extEvent);

    // 2. 派发 window.postMessage 广播作为补充链路
    window.postMessage({
      source: 'douyin-comment-collector',
      action: 'JUMP_COMMENT',
      payload
    }, '*');

    // 3. 安全降级：由浏览器原生开启新标签页，插件会在新页面加载后嗅探并实施高亮滚动定位
    window.open(`https://www.douyin.com/video/${videoId}`, '_blank');
    
    if (hasExtension) {
      showNotification('正在通过浏览器插件定位至该评论...', 'success');
    }
  };

  // Format numbers (e.g. 12800 -> 1.28w)
  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    return num.toLocaleString();
  };

  // Convert timestamp to readable format
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '未知时间';
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '未知时间';
    }
  };

  // Helper to resolve multiple aweme_ids or creator profiles from textarea
  const resolveAllAwemeIds = async (input) => {
    const lines = input.split(/[\n,，;；]/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      throw new Error('请输入视频链接/个人主页或作品ID');
    }
    
    const resolvedIds = [];
    setProgressText(`准备解析 ${lines.length} 个链接...`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d+$/.test(line)) {
        resolvedIds.push({ id: line, original: line });
      } else if (line.includes('/user/') || line.includes('/user_post') || line.includes('sec_uid') || (!line.includes('/video/') && !line.includes('modal_id='))) {
        // Resolve as creator profile link
        try {
          setProgressText(`正在解析第 ${i + 1}/${lines.length} 个链接 (创作者主页)...`);
          const response = await fetch(`/api/douyin/web/get_sec_user_id?url=${encodeURIComponent(line)}`);
          if (!response.ok) throw new Error();
          const resData = await response.json();
          
          if (resData.code === 200 && resData.data) {
            const secUserId = resData.data;
            setProgressText(`成功解析创作者，正在获取最近前 ${profileVideoLimit} 个作品...`);
            
            // Fetch creator's videos
            const videosResp = await fetch(`/api/douyin/web/fetch_user_post_videos?sec_user_id=${secUserId}&max_cursor=0&count=${profileVideoLimit}`);
            if (!videosResp.ok) throw new Error("获取创作者作品失败");
            const videosData = await videosResp.json();
            
            if (videosData.code === 200 && videosData.data && videosData.data.aweme_list) {
              const awemeList = videosData.data.aweme_list;
              let matchedCount = 0;
              
              for (const video of awemeList) {
                const videoId = String(video.aweme_id);
                const desc = video.desc || video.title || `视频作品 #${videoId}`;
                
                // Apply video title keyword filter
                const matchesVideoKeyword = !videoKeywordFilter.trim() || 
                  desc.toLowerCase().includes(videoKeywordFilter.trim().toLowerCase());
                
                if (matchesVideoKeyword) {
                  resolvedIds.push({ 
                    id: videoId, 
                    original: `创作者视频 #${videoId}`,
                    title: desc,
                    cover: video.video?.cover?.url_list?.[0] || video.video?.dynamic_cover?.url_list?.[0] || '',
                    authorName: video.author?.nickname || '抖音创作者',
                    authorAvatar: video.author?.avatar_thumb?.url_list?.[0] || '',
                    likes: video.statistics?.digg_count || video.statistics?.like_count || 0,
                    commentsCount: video.statistics?.comment_count || 0,
                    shares: video.statistics?.share_count || 0,
                    collects: video.statistics?.collect_count || 0
                  });
                  matchedCount++;
                }
              }
              
              setProgressText(`成功从创作者主页筛选出 ${matchedCount} 个匹配的视频！`);
              continue;
            }
          }
        } catch (e) {
          console.warn(`解析创作者主页失败，尝试作为普通视频解析:`, e);
        }
        
        // Fallback to video ID extraction
        try {
          const response = await fetch(`/api/douyin/web/get_aweme_id?url=${encodeURIComponent(line)}`);
          if (response.ok) {
            const resData = await response.json();
            if (resData.code === 200 && resData.data) {
              resolvedIds.push({ id: String(resData.data), original: line });
              continue;
            }
          }
        } catch (e) {
          // Final regex check
          const match = line.match(/\/video\/(\d+)/) || line.match(/modal_id=(\d+)/);
          if (match && match[1]) {
            resolvedIds.push({ id: match[1], original: line });
          }
        }
      } else {
        // Standard video URL
        try {
          setProgressText(`正在解析第 ${i + 1}/${lines.length} 个视频 ID...`);
          const response = await fetch(`/api/douyin/web/get_aweme_id?url=${encodeURIComponent(line)}`);
          if (!response.ok) throw new Error();
          const resData = await response.json();
          if (resData.code === 200 && resData.data) {
            resolvedIds.push({ id: String(resData.data), original: line });
          } else {
            const match = line.match(/\/video\/(\d+)/) || line.match(/modal_id=(\d+)/);
            if (match && match[1]) {
              resolvedIds.push({ id: match[1], original: line });
            }
          }
        } catch (e) {
          const match = line.match(/\/video\/(\d+)/) || line.match(/modal_id=(\d+)/);
          if (match && match[1]) {
            resolvedIds.push({ id: match[1], original: line });
          }
        }
      }
    }
    
    if (resolvedIds.length === 0) {
      throw new Error('未成功解析出任何有效的视频ID或创作者作品，请确认输入内容。');
    }
    
    return resolvedIds;
  };

  // Resolve videos from keyword search via Custom Playwright API
  const resolveVideosBySearch = async (keyword, apiUrl) => {
    if (!keyword.trim()) {
      throw new Error('请输入搜索关键词');
    }
    if (!apiUrl.trim()) {
      throw new Error('请输入搜索 API 接口服务地址');
    }

    const resolvedIds = [];
    const totalPages = parseInt(searchPages, 10) || 1;

    setProgressText(`开始使用自定义搜索 API 进行视频搜索，关键词: "${keyword}"...`);

    // Clean api base URL (remove trailing slash if present)
    const baseApi = apiUrl.trim().replace(/\/+$/, '');

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      if (!crawlActiveRef.current) break;

      setProgressText(`正在搜索作品列表 (第 ${currentPage}/${totalPages} 页)...`);

      // Build API request URL
      const searchUrl = `${baseApi}/api/search?keyword=${encodeURIComponent(keyword.trim())}&page=${currentPage}`;

      try {
        const response = await fetch(searchUrl);
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('需要更新 Cookie 授权，请在接口服务器终端运行 login.py');
          }
          throw new Error(`HTTP 异常 ${response.status}`);
        }

        const resData = await response.json();
        
        const videoList = resData.videos || [];
        if (videoList.length === 0) {
          setProgressText(`搜索已到底，第 ${currentPage} 页无更多匹配作品`);
          break;
        }

        let pageMatchedCount = 0;
        for (const video of videoList) {
          if (!video) continue;

          const videoId = String(video.video_id || '');
          if (!videoId) continue;

          const desc = video.title || `视频作品 #${videoId}`;

          // Extra validation: Apply client-side video title keyword filter if configured
          const matchesVideoKeyword = !videoKeywordFilter.trim() || 
            desc.toLowerCase().includes(videoKeywordFilter.trim().toLowerCase());

          if (matchesVideoKeyword) {
            resolvedIds.push({
              id: videoId,
              original: `搜索 "${keyword}" 第 ${currentPage} 页 #${videoId}`,
              title: desc,
              cover: video.cover_url || video.dynamic_cover_url || '',
              authorName: video.author?.name || '抖音创作者',
              authorAvatar: video.author?.avatar || '',
              likes: video.likes || 0,
              commentsCount: video.comments || 0,
              shares: video.shares || 0,
              collects: video.favorites || 0
            });
            pageMatchedCount++;
          }
        }

        setProgressText(`成功加载第 ${currentPage} 页，搜集到 ${pageMatchedCount} 个符合条件的作品`);
        
        // Respectful throttle between page searches
        if (currentPage < totalPages) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

      } catch (err) {
        console.error(`搜索接口调用失败 (第 ${currentPage} 页):`, err);
        throw new Error(`第 ${currentPage} 页搜索请求失败: ${err.message}`);
      }
    }

    if (resolvedIds.length === 0) {
      throw new Error('未搜索到任何有效的视频作品，请更换关键词或检查接口配置。');
    }

    setProgressText(`搜索模块执行完毕！共筛选出 ${resolvedIds.length} 个视频准备抓取评论。`);
    return resolvedIds;
  };

  // Fetch video info helper (gracefully return info or fallback)
  const fetchSingleVideoDetails = async (id) => {
    try {
      const response = await fetch(`/api/douyin/web/fetch_one_video?aweme_id=${id}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const resData = await response.json();
      if (resData.code === 200 && resData.data) {
        const item = resData.data;
        return {
          title: item.desc || item.title || `视频作品 #${id}`,
          cover: item.video?.cover?.url_list?.[0] || item.video?.dynamic_cover?.url_list?.[0] || '',
          authorName: item.author?.nickname || '抖音创作者',
          authorAvatar: item.author?.avatar_thumb?.url_list?.[0] || '',
          likes: item.statistics?.digg_count || item.statistics?.like_count || 0,
          commentsCount: item.statistics?.comment_count || 0,
          shares: item.statistics?.share_count || 0,
          collects: item.statistics?.collect_count || 0,
          awemeId: id
        };
      }
    } catch (e) {
      console.warn(`读取视频 ${id} 详情失败:`, e);
    }
    
    // Return fallback info on error/timeout
    return {
      title: `视频作品 #${id}`,
      cover: '',
      authorName: '抖音创作者',
      authorAvatar: '',
      likes: 0,
      commentsCount: 0,
      shares: 0,
      collects: 0,
      awemeId: id,
      isFallback: true
    };
  };

  // ============ DATABASE FUNCTIONS ============

  // Save crawled comments to database
  const handleSaveToDatabase = async () => {
    if (comments.length === 0) {
      showNotification('没有可保存的评论数据', 'error');
      return;
    }

    setIsSavingToDb(true);
    setDbSaveResult(null);

    try {
      const uniqueVideoIds = [...new Set(comments.map(c => String(c.video_id || c.aweme_id)))].filter(Boolean);
      
      const videosPayload = uniqueVideoIds.map(vid => {
        const cached = crawledVideosMap[vid];
        if (cached) {
          return cached;
        }
        // Fallback reconstruction
        const matchingComment = comments.find(c => String(c.video_id) === vid || String(c.aweme_id) === vid);
        const title = matchingComment ? (matchingComment.video_title || `视频作品 #${vid}`) : `视频作品 #${vid}`;
        return {
          aweme_id: vid,
          title: title,
          cover_url: '',
          author_name: '抖音创作者',
          author_avatar: '',
          likes: 0,
          comments_count: 0,
          shares: 0,
          collects: 0
        };
      });

      const payload = {
        video: videosPayload[0] || null, // 保持向后兼容
        videos: videosPayload,           // 发送全部已抓取的视频进行批量同步
        comments: comments.map(c => ({
          cid: String(c.cid),
          aweme_id: c.video_id || c.aweme_id || '',
          parent_comment_id: c.reply_id || c.parent_comment_id || null,
          user_nickname: c.user?.nickname || c.user_nickname || '未知用户',
          user_id: c.user?.uid || c.user?.id || c.user_id || null,
          user_avatar: c.user?.avatar_thumb?.url_list?.[0] || c.user_avatar || '',
          text: c.text || '',
          digg_count: c.digg_count || 0,
          reply_count: c.reply_comment_total || c.reply_count || 0,
          ip_label: c.ip_label || null,
          create_time: c.create_time || null
        })),
        task: {
          task_type: crawlMode,
          input_source: crawlMode === 'search' ? searchKeyword : inputUrls.substring(0, 500),
          keyword_filter: keywordFilter || null,
          video_filter: videoKeywordFilter || null
        }
      };

      const response = await fetch('/api/db/sync/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`服务器返回 HTTP ${response.status}`);
      }

      const result = await response.json();
      const syncData = result.data || result;
      setDbSaveResult({
        insertedComments: syncData.comments_inserted || 0,
        skippedComments: (comments.length - (syncData.comments_inserted || 0)),
        videosProcessed: videosPayload.length
      });
      showNotification(`成功保存到数据库！新增 ${syncData.comments_inserted || 0} 条，接收 ${syncData.comments_received || comments.length} 条，处理了 ${videosPayload.length} 个视频`, 'success');
    } catch (err) {
      console.error('保存到数据库失败:', err);
      showNotification(`保存失败: ${err.message}。请确认后端服务已启动 (端口 3001)`, 'error');
    } finally {
      setIsSavingToDb(false);
    }
  };

  // Fetch comments from database with filters
  const fetchDbComments = useCallback(async (page = 1) => {
    setDbIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(dbPageSize),
        sort: dbSortOrder
      });
      if (dbSearchVideoId) params.append('aweme_id', dbSearchVideoId);
      if (dbSearchIp) params.append('ip_label', dbSearchIp);

      let url;
      if (dbSearchQuery.trim()) {
        params.append('q', dbSearchQuery.trim());
        url = `/api/db/comments/search?${params}`;
      } else {
        url = `/api/db/comments?${params}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const result = data.data || data;

      setDbComments(result.list || result.comments || result.rows || []);
      setDbTotalCount(result.total || result.count || 0);
      setDbPage(page);
    } catch (err) {
      console.error('查询数据库失败:', err);
      showNotification(`数据库查询失败: ${err.message}`, 'error');
    } finally {
      setDbIsLoading(false);
    }
  }, [dbSearchQuery, dbSearchVideoId, dbSearchIp, dbSortOrder, dbPageSize]);

  // 监听数据库筛选条件与排序变化，自动触发查询
  useEffect(() => {
    if (activeTab === 'database') {
      fetchDbComments(1);
    }
  }, [dbSearchVideoId, dbSortOrder, activeTab, fetchDbComments]);

  // Fetch database stats
  const fetchDbStats = async () => {
    try {
      const response = await fetch('/api/db/comments/stats');
      if (!response.ok) throw new Error();
      const data = await response.json();
      const result = data.data || data;
      setDbStats({
        totalComments: result.total || 0,
        totalVideos: result.total_videos || 0,
        totalLikes: result.total_likes || 0,
        ipDistribution: result.ip_distribution || [],
        topLiked: result.top_liked || [],
      });
    } catch (err) {
      console.error('获取统计失败:', err);
    }
  };

  // Fetch all videos from database
  const fetchDbVideos = async () => {
    try {
      const response = await fetch('/api/db/videos');
      if (!response.ok) throw new Error();
      const data = await response.json();
      const result = data.data || data;
      setDbVideos(result.videos || result.list || result || []);
    } catch (err) {
      console.error('获取视频列表失败:', err);
    }
  };

  // Fetch crawl task history
  const fetchDbTasks = async () => {
    try {
      const response = await fetch('/api/db/tasks');
      if (!response.ok) throw new Error();
      const data = await response.json();
      const result = data.data || data;
      setDbTasks(result.tasks || result.list || result || []);
    } catch (err) {
      console.error('获取任务历史失败:', err);
    }
  };

  // Delete comment from database
  const handleDbDeleteComment = async (cid) => {
    try {
      const response = await fetch(`/api/db/comments/${cid}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      showNotification('评论已从数据库中删除', 'success');
      fetchDbComments(dbPage);
    } catch (err) {
      showNotification('删除失败', 'error');
    }
  };

  // Master Crawl Executor (supporting batch crawl and keywords)
  const startCrawling = async () => {
    if (isCrawling) return;
    
    setIsCrawling(true);
    setStopRequested(false);
    setComments([]);
    setVideoInfo(null);
    setCrawledVideosMap({});
    setFetchedCount(0);
    setPercentProgress(0);
    setTotalEstimated(0);
    crawlActiveRef.current = true;

    try {
      // 1. Resolve all input IDs or trigger keyword-based search resolution
      let videoList = [];
      if (crawlMode === 'search') {
        videoList = await resolveVideosBySearch(searchKeyword, searchApiUrl);
      } else {
        videoList = await resolveAllAwemeIds(inputUrls);
      }
      showNotification(`解析成功，即将开始抓取 ${videoList.length} 个视频的评论`, 'info');
      
      const fetchLimit = parseInt(maxComments, 10) || 100000;
      
      // Calculate total expected comments if available (sum of all video stats)
      let aggregatedTotalComments = 0;
      videoList.forEach(v => {
        aggregatedTotalComments += (v.commentsCount || 0);
      });
      setTotalEstimated(aggregatedTotalComments || (videoList.length * 100));

      const videoQueue = [...videoList];
      const workerCount = Math.min(concurrency, videoList.length);
      
      // Initialize active workers status
      const initialWorkers = Array.from({ length: workerCount }, (_, i) => ({
        id: i + 1,
        status: 'working',
        videoTitle: '准备就绪...',
        fetchedCount: 0
      }));
      setActiveWorkers(initialWorkers);

      let allComments = [];
      
      // Thread-safe functional state updater with cid deduplication
      const appendComments = (newComments, videoId, videoTitle) => {
        setComments(prev => {
          const seenCids = new Set(prev.map(c => String(c.cid).trim()));
          const uniqueNew = [];
          
          newComments.forEach(item => {
            if (item && item.cid) {
              const cidStr = String(item.cid).trim();
              if (!seenCids.has(cidStr)) {
                // Normalize item.cid as strict string
                item.cid = cidStr;
                if (item.reply_comment) {
                  item.reply_comment = item.reply_comment.map(reply => {
                    if (reply && reply.cid) {
                      reply.cid = String(reply.cid).trim();
                    }
                    return reply;
                  });
                }
                
                // Attach video meta fields for tracking and spreadsheet export
                item.video_id = videoId;
                item.video_title = videoTitle;
                uniqueNew.push(item);
                seenCids.add(cidStr);
              }
            }
          });
          
          const merged = [...prev, ...uniqueNew];
          allComments = merged; // Update local scope reference
          setFetchedCount(merged.length);
          
          // Update progress calculations
          const currentTarget = Math.min(aggregatedTotalComments || (videoList.length * fetchLimit), videoList.length * fetchLimit);
          const percent = Math.min(Math.round((merged.length / currentTarget) * 100), 100);
          setPercentProgress(percent);
          
          return merged;
        });
      };

      const updateWorkerState = (workerId, updateFields) => {
        setActiveWorkers(prev => prev.map(w => w.id === workerId ? { ...w, ...updateFields } : w));
      };

      const runWorker = async (workerId) => {
        while (videoQueue.length > 0 && crawlActiveRef.current) {
          const currentVideo = videoQueue.shift();
          if (!currentVideo) break;

          updateWorkerState(workerId, {
            status: 'working',
            videoTitle: currentVideo.title || currentVideo.desc || `作品 ID: ${currentVideo.id}`,
            fetchedCount: 0
          });

          setProgressText(`[线程 ${workerId}] 正在加载视频详情 (ID: ${currentVideo.id})...`);

          let details;
          try {
            if (currentVideo.likes !== undefined) {
              details = currentVideo;
            } else {
              details = await fetchSingleVideoDetails(currentVideo.id);
            }
          } catch (err) {
            console.error(`线程 ${workerId} 获取详情失败:`, err);
            details = {
              title: `视频作品 #${currentVideo.id}`,
              cover: '',
              authorName: '抖音创作者',
              authorAvatar: '',
              likes: 0,
              commentsCount: 0,
              shares: 0,
              collects: 0,
              awemeId: currentVideo.id,
              isFallback: true
            };
          }

          // Apply video title keyword filter
          const matchesVideoKeyword = !videoKeywordFilter.trim() || 
            (details.title && details.title.toLowerCase().includes(videoKeywordFilter.trim().toLowerCase()));
          
          if (!matchesVideoKeyword) {
            setProgressText(`[线程 ${workerId}] 标题不匹配 "${videoKeywordFilter}"，跳过该作品...`);
            updateWorkerState(workerId, {
              status: 'idle',
              videoTitle: `跳过不匹配作品`,
              fetchedCount: 0
            });
            continue;
          }

          // Update header info for first matching details
          setVideoInfo(prev => prev ? prev : details);

          // Add to crawledVideosMap with full normalized details
          const normalizedDetails = {
            aweme_id: String(details.awemeId || details.id || currentVideo.id),
            title: details.title || `视频作品 #${currentVideo.id}`,
            cover_url: details.cover || details.cover_url || '',
            author_name: details.authorName || details.author_name || '抖音创作者',
            author_avatar: details.authorAvatar || details.author_avatar || '',
            likes: parseInt(details.likes, 10) || 0,
            comments_count: parseInt(details.commentsCount || details.comments_count, 10) || 0,
            shares: parseInt(details.shares, 10) || 0,
            collects: parseInt(details.collects || details.favorites || details.collect_count, 10) || 0
          };
          setCrawledVideosMap(prev => ({
            ...prev,
            [normalizedDetails.aweme_id]: normalizedDetails
          }));

          let cursor = 0;
          let hasMore = true;
          let videoCommentsFetched = 0;

          updateWorkerState(workerId, {
            videoTitle: details.title,
            fetchedCount: 0
          });

          while (hasMore && crawlActiveRef.current) {
            if (videoCommentsFetched >= fetchLimit) {
              break;
            }

            setProgressText(`[线程 ${workerId}] 抓取 "${details.title.substring(0, 10)}..." (已获取: ${videoCommentsFetched} 条, 总抓取: ${allComments.length} 条)`);

            const count = 20;
            let url;
            const headers = {};

            if (commentApiType === 'tikhub') {
              url = `/api/db/tikhub/fetch_video_comments?aweme_id=${currentVideo.id}&cursor=${cursor}&count=${count}`;
              if (tikhubToken) {
                headers['Authorization'] = `Bearer ${tikhubToken}`;
              }
              if (tikhubApiUrl) {
                headers['X-TikHub-API-URL'] = tikhubApiUrl;
              }
            } else {
              url = `/api/douyin/web/fetch_video_comments?aweme_id=${currentVideo.id}&cursor=${cursor}&count=${count}`;
            }

            try {
              const response = await fetch(url, { headers });
              if (!response.ok) {
                console.error(`线程 ${workerId} 请求失败`);
                break;
              }

              const resData = await response.json();
              if (resData.code !== 200 || !resData.data) {
                console.error(`线程 ${workerId} 接口报错`);
                break;
              }

              const cdata = resData.data;
              const commentList = cdata.comments || [];

              if (commentList.length === 0) {
                break;
              }

              // Apply comment text filtering
              const uniqueCommentsInChunk = [];
              for (const item of commentList) {
                if (item && item.cid) {
                  const filterKeywords = keywordFilter.trim()
                    ? keywordFilter.split(/[,，、\s|/]+/).map(k => k.trim()).filter(Boolean)
                    : [];

                  const matchesKeyword = filterKeywords.length === 0 || 
                    filterKeywords.some(k => item.text && item.text.toLowerCase().includes(k.toLowerCase()));

                  if (matchesKeyword) {
                    uniqueCommentsInChunk.push(item);
                  }
                }
              }

              // Thread-safe state update
              appendComments(uniqueCommentsInChunk, currentVideo.id, details.title);

              videoCommentsFetched += commentList.length;
              updateWorkerState(workerId, {
                fetchedCount: videoCommentsFetched
              });

              cursor = cdata.cursor || (cursor + commentList.length);
              hasMore = cdata.has_more === 1 || cdata.has_more === true;

              // Organic randomized delay per request (800ms - 1100ms)
              const randomDelay = 800 + Math.random() * 300;
              await new Promise(resolve => setTimeout(resolve, randomDelay));

            } catch (err) {
              console.error(`线程 ${workerId} 网络异常:`, err);
              break;
            }
          }

          updateWorkerState(workerId, {
            status: 'idle',
            videoTitle: `已完成: ${details.title.substring(0, 10)}...`
          });

          // Short sleep between queue pops
          if (videoQueue.length > 0 && crawlActiveRef.current) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        updateWorkerState(workerId, {
          status: 'completed',
          videoTitle: '任务抓取完毕 🏁',
          fetchedCount: 0
        });
      };

      // Kickoff concurrent workers
      const workerPromises = Array.from({ length: workerCount }, (_, i) => runWorker(i + 1));
      
      // Await all workers
      await Promise.all(workerPromises);

      if (!crawlActiveRef.current) {
        setProgressText('抓取任务被手动终止');
        showNotification('抓取任务已手动中止，数据已暂存', 'warning');
      } else {
        setProgressText(`所有视频采集结束，共成功收集并过滤到 ${allComments.length} 条评论！`);
        showNotification('并发采集完成！', 'success');
      }

    } catch (err) {
      console.error('爬取异常:', err);
      setProgressText(`任务中断: ${err.message}`);
      showNotification(`数据采集异常: ${err.message}`, 'error');
    } finally {
      setIsCrawling(false);
      crawlActiveRef.current = false;
    }
  };

  // Stop Crawl Execution
  const stopCrawling = () => {
    setStopRequested(true);
    crawlActiveRef.current = false;
    setProgressText('正在发送终止指令，请稍候...');
  };

  // Export Data to Excel (incorporating video details)
  const handleExportExcel = () => {
    if (comments.length === 0) {
      showNotification('无可导出的评论数据', 'error');
      return;
    }

    const exportData = comments.map((c, index) => ({
      '序号': index + 1,
      '视频ID': c.video_id || '未知ID',
      '视频标题': c.video_title || '未知视频',
      '评论ID': c.cid,
      '用户昵称': c.user?.nickname || '未知用户',
      '评论内容': c.text,
      '点赞数': c.digg_count || 0,
      '回复数': c.reply_comment_total || 0,
      'IP属地': c.ip_label || '未知',
      '发布时间': formatTimestamp(c.create_time)
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '评论数据集');
    
    // Auto-fit columns dynamically
    const max_len = exportData.reduce((acc, row) => {
      Object.keys(row).forEach((key) => {
        const val = row[key] ? row[key].toString() : '';
        acc[key] = Math.max(acc[key] || 0, val.length * 2);
      });
      return acc;
    }, {});
    worksheet['!cols'] = Object.keys(max_len).map(key => ({ wch: Math.min(Math.max(max_len[key], 10), 60) }));

    const fileName = `抖音评论数据集_关键词_${keywordFilter || 'all'}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showNotification('已成功导出高保真 Excel 文件！', 'success');
  };

  // Export Data to CSV (incorporating video details)
  const handleExportCSV = () => {
    if (comments.length === 0) {
      showNotification('无可导出的评论数据', 'error');
      return;
    }

    const headers = ['序号', '视频ID', '视频标题', '评论ID', '用户昵称', '评论内容', '点赞数', '回复数', 'IP属地', '发布时间'];
    
    const rows = comments.map((c, index) => [
      index + 1,
      `"${c.video_id || ''}"`,
      `"${(c.video_title || '未知视频').replace(/"/g, '""')}"`,
      `"${c.cid}"`,
      `"${(c.user?.nickname || '未知用户').replace(/"/g, '""')}"`,
      `"${(c.text || '').replace(/"/g, '""')}"`,
      c.digg_count || 0,
      c.reply_comment_total || 0,
      `"${c.ip_label || '未知'}"`,
      `"${formatTimestamp(c.create_time)}"`
    ]);

    // Use UTF-8 BOM encoding
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `抖音评论数据集_关键词_${keywordFilter || 'all'}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('已成功导出 CSV 文件！', 'success');
  };

  // Local comments filter & sorting
  const filteredComments = comments
    .filter(c => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const nickname = (c.user?.nickname || '').toLowerCase();
      const text = (c.text || '').toLowerCase();
      const ip = (c.ip_label || '').toLowerCase();
      const vid = (c.video_id || '').toLowerCase();
      return nickname.includes(query) || text.includes(query) || ip.includes(query) || vid.includes(query);
    })
    .sort((a, b) => {
      if (sortOrder === 'likes') {
        return (b.digg_count || 0) - (a.digg_count || 0);
      } else {
        return (b.create_time || 0) - (a.create_time || 0);
      }
    });

  // Defensive unique rendering keys to prevent any accidental console key warnings
  const renderedComments = [];
  const seenRenderedCids = new Set();
  for (const c of filteredComments) {
    const key = String(c.cid);
    if (!seenRenderedCids.has(key)) {
      renderedComments.push(c);
      seenRenderedCids.add(key);
    }
  }

  // Calculate advanced statistics for the insights tab
  const getInsights = () => {
    if (comments.length === 0) return null;

    // 1. IP Distribution
    const ipCounts = {};
    comments.forEach(c => {
      const label = c.ip_label || '未知位置';
      ipCounts[label] = (ipCounts[label] || 0) + 1;
    });
    const ipDistribution = Object.keys(ipCounts)
      .map(ip => ({ label: ip, count: ipCounts[ip] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 2. Keyword Frequency
    const stopWords = ['的', '了', '是', '我', '你', '他', '她', '它', '在', '有', '个', '和', '这', '都', '不', '也', '去', '就', '要', '吗', '吧', '啊', '得', '哈', '着', '里', '那', '这', '呢', '什么', '谁', '我们', '你们', '他们', '我们', '自己', '怎么', '觉得', '感觉', '一个', '还是', '真是', '就是', '可以', '这个', '那个', '这里', '那里', '已经', '非常', '真的', '哈哈', '哈哈哈', '这一', '那个', '还有', '一下', '一些', '这样'];
    const wordCounts = {};
    comments.forEach(c => {
      if (!c.text) return;
      const matches = c.text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      matches.forEach(w => {
        if (!stopWords.includes(w)) {
          wordCounts[w] = (wordCounts[w] || 0) + 1;
        }
      });
    });
    const keywords = Object.keys(wordCounts)
      .map(w => ({ word: w, count: wordCounts[w] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 3. User engagement details
    const totalLikes = comments.reduce((acc, c) => acc + (c.digg_count || 0), 0);
    const avgLikes = (totalLikes / comments.length).toFixed(1);
    const totalReplies = comments.reduce((acc, c) => acc + (c.reply_comment_total || 0), 0);
    const hasRepliesPercent = ((comments.filter(c => (c.reply_comment_total || 0) > 0).length / comments.length) * 100).toFixed(1);

    // 4. Most highly-liked comments (defensively deduplicated by cid)
    const sortedComments = [...comments].sort((a, b) => (b.digg_count || 0) - (a.digg_count || 0));
    const uniqueTopComments = [];
    const seenTopCids = new Set();
    for (const c of sortedComments) {
      const key = String(c.cid);
      if (!seenTopCids.has(key)) {
        uniqueTopComments.push(c);
        seenTopCids.add(key);
      }
    }
    const topComments = uniqueTopComments.slice(0, 3);

    return {
      ipDistribution,
      keywords,
      avgLikes,
      totalLikes,
      totalReplies,
      hasRepliesPercent,
      topComments
    };
  };

  const insights = getInsights();

  // Reset App state to idle
  const handleReset = () => {
    setComments([]);
    setVideoInfo(null);
    setAwemeId('');
    setInputUrls('');
    setFetchedCount(0);
    setPercentProgress(0);
    setProgressText('');
    setTotalEstimated(0);
    setActiveTab('comments');
  };

  return (
    <div className="app-layout">
      {/* Top Premium Navbar */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">D</div>
          <span className="logo-text">抖音视频数据 & 评论深度收集分析平台</span>
        </div>
        
        <div className="api-status-badge">
          <div className={`status-dot ${isCrawling ? 'loading' : 'active'}`}></div>
          <span>{isCrawling ? '正在采集数据' : '本地API就绪'}</span>
        </div>
      </header>

      {/* Main Grid container */}
      <main className="dashboard-container">
        
        {/* Left Side Panel - Crawl Control */}
        <section className="glass-card sidebar-panel">
          <h2 className="sidebar-title">
            <Layers size={18} className="text-primary" />
            <span>数据爬取控制台</span>
          </h2>

          {/* Mode Switcher Tabs */}
          <div className="mode-tabs" style={{ display: 'flex', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(0,0,0,0.25)', padding: '4px', border: '1px solid var(--border-color)', marginBottom: '4px' }}>
            <button 
              className={`mode-tab-btn ${crawlMode === 'links' ? 'active' : ''}`}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderRadius: 'calc(var(--radius-sm) - 2px)',
                border: 'none',
                background: crawlMode === 'links' ? 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' : 'transparent',
                color: crawlMode === 'links' ? 'white' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
              onClick={() => setCrawlMode('links')}
              disabled={isCrawling}
            >
              <Video size={13} />
              <span>链接/主页批量</span>
            </button>
            <button 
              className={`mode-tab-btn ${crawlMode === 'search' ? 'active' : ''}`}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderRadius: 'calc(var(--radius-sm) - 2px)',
                border: 'none',
                background: crawlMode === 'search' ? 'linear-gradient(135deg, var(--color-secondary), var(--color-accent))' : 'transparent',
                color: crawlMode === 'search' ? 'white' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
              onClick={() => setCrawlMode('search')}
              disabled={isCrawling}
            >
              <Search size={13} />
              <span>关键词全网搜索</span>
            </button>
          </div>

          {crawlMode === 'links' ? (
            <>
              <div className="input-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                <label className="input-label">视频链接或视频ID列表</label>
                <textarea 
                  className="input-field" 
                  style={{ minHeight: '100px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.4' }}
                  placeholder="支持批量输入！&#10;输入抖音分享链接 或 作品ID。&#10;多个链接可用 换行 或 逗号 隔开。" 
                  value={inputUrls}
                  onChange={(e) => setInputUrls(e.target.value)}
                  disabled={isCrawling}
                />
                <div className="help-text" style={{fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                  <Info size={12} />
                  <span>多视频爬取时，数据将自动汇聚</span>
                </div>
              </div>

              <div className="input-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                <label className="input-label" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <Layers size={13} className="text-accent" />
                  <span>创作者主页扫描作品数</span>
                </label>
                <select 
                  className="input-field" 
                  value={profileVideoLimit}
                  onChange={(e) => setProfileVideoLimit(parseInt(e.target.value, 10))}
                  disabled={isCrawling}
                >
                  <option value={10}>最近 10 个作品</option>
                  <option value={20}>最近 20 个作品 (推荐)</option>
                  <option value={50}>最近 50 个作品 (深度)</option>
                  <option value={100}>最近 100 个作品 (超深度)</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="input-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                <label className="input-label" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <Search size={13} style={{color: 'var(--color-secondary)'}} />
                  <span>抖音视频搜索关键词</span>
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="例如: 手机评测、数码开箱 (全网检索)" 
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  disabled={isCrawling}
                />
              </div>

              <div className="input-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                <label className="input-label" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <Info size={13} style={{color: 'var(--color-primary)'}} />
                  <span>搜索 API 接口服务地址</span>
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="如: http://localhost:8000" 
                  value={searchApiUrl}
                  onChange={(e) => setSearchApiUrl(e.target.value)}
                  disabled={isCrawling}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div className="input-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                <label className="input-label" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <Layers size={13} className="text-secondary" />
                  <span>搜索检索深度 (抓取页数)</span>
                </label>
                <select 
                  className="input-field" 
                  value={searchPages}
                  onChange={(e) => setSearchPages(parseInt(e.target.value, 10))}
                  disabled={isCrawling}
                >
                  <option value={1}>抓取第 1 页 (~16个作品)</option>
                  <option value={2}>抓取前 2 页 (~32个作品)</option>
                  <option value={3}>抓取前 3 页 (~48个作品)</option>
                  <option value={4}>抓取前 4 页 (~64个作品)</option>
                  <option value={5}>抓取前 5 页 (~80个作品 - 深度模式)</option>
                  <option value={8}>抓取前 8 页 (~128个作品 - 超强检索)</option>
                  <option value={12}>抓取前 12 页 (~192个作品 - 极限探索)</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <label className="input-label" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Filter size={13} className="text-secondary" />
              <span>评论内容关键词过滤 (可选)</span>
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="例如: 好用 质量 买过 (支持多词，空格/逗号/顿号隔开)" 
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              disabled={isCrawling}
            />
          </div>

          <div className="input-group">
            <label className="input-label" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Video size={13} className="text-primary" />
              <span>视频标题关键词过滤 (可选)</span>
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="例如: 手机、评测 (仅采集匹配作品)" 
              value={videoKeywordFilter}
              onChange={(e) => setVideoKeywordFilter(e.target.value)}
              disabled={isCrawling}
            />
          </div>

          <div className="input-group">
            <label className="input-label">单视频爬取限制 (深度)</label>
            <select 
              className="input-field" 
              value={maxComments}
              onChange={(e) => setMaxComments(parseInt(e.target.value, 10))}
              disabled={isCrawling}
            >
              <option value={50}>抓取前 50 条 (极速模式)</option>
              <option value={200}>抓取前 200 条 (标准模式)</option>
              <option value={500}>抓取前 500 条 (深层模式)</option>
              <option value={1000}>抓取前 1,000 条 (极限模式)</option>
              <option value={5000}>抓取前 5,000 条 (超深层模式)</option>
              <option value={100000}>抓取全部评论 (需要更长时间)</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Layers size={13} className="text-secondary" />
              <span>并发采集线程数</span>
            </label>
            <select 
              className="input-field" 
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
              disabled={isCrawling}
            >
              <option value={1}>1 线程 (单视频顺序采集)</option>
              <option value={2}>2 线程 (推荐，兼顾速度与防封)</option>
              <option value={3}>3 线程 (极速，高频调用易限流)</option>
              <option value={4}>4 线程 (高速，易被拦截建议少用)</option>
            </select>
            {concurrency > 2 && (
              <div className="help-text" style={{fontSize: '0.72rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px'}}>
                <AlertCircle size={12} style={{flexShrink: 0}} />
                <span>⚠️ 高并发将显著增加IP限流或人机拦截风险！</span>
              </div>
            )}
          </div>

          {/* 评论数据 API 配置 */}
          <div className="input-group" style={{ 
            marginTop: '15px', 
            padding: '12px', 
            borderRadius: 'var(--radius-sm)', 
            border: '1px solid rgba(255,255,255,0.08)', 
            background: 'rgba(255,255,255,0.02)' 
          }}>
            <label className="input-label" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.8rem', 
              color: 'var(--color-primary)', 
              fontWeight: '600',
              marginBottom: '10px'
            }}>
              <Database size={13} />
              <span>评论数据 API 配置</span>
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>接口服务类型</label>
                <select 
                  className="input-field" 
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                  value={commentApiType}
                  onChange={(e) => setCommentApiType(e.target.value)}
                  disabled={isCrawling}
                >
                  <option value="local">本地默认代理 (http://10.11.1.88)</option>
                  <option value="tikhub">TikHub 开发者接口 (tikhub.dev)</option>
                </select>
              </div>

              {commentApiType === 'tikhub' && (
                <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>TikHub 接口地址</label>
                    <input 
                      type="text" 
                      className="input-field"
                      style={{ fontSize: '0.8rem', padding: '6px 10px', fontFamily: 'monospace' }}
                      placeholder="https://api.tikhub.dev" 
                      value={tikhubApiUrl}
                      onChange={(e) => setTikhubApiUrl(e.target.value)}
                      disabled={isCrawling}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }}>TikHub 授权 Token</label>
                    <input 
                      type="password" 
                      className="input-field"
                      style={{ fontSize: '0.8rem', padding: '6px 10px', fontFamily: 'monospace' }}
                      placeholder="输入您的 TikHub Token" 
                      value={tikhubToken}
                      onChange={(e) => setTikhubToken(e.target.value)}
                      disabled={isCrawling}
                    />
                    <div className="help-text" style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      在 tikhub.dev 注册获取 Authorization Token
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px'}}>
            {!isCrawling ? (
              <button 
                className="btn-primary" 
                onClick={startCrawling}
                disabled={crawlMode === 'search' ? (!searchKeyword.trim() || !searchApiUrl.trim()) : !inputUrls.trim()}
              >
                <Play size={16} fill="white" />
                <span>开始爬取</span>
              </button>
            ) : (
              <button 
                className="btn-primary" 
                style={{background: 'linear-gradient(135deg, var(--color-danger), #B91C1C)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.2)'}}
                onClick={stopCrawling}
                disabled={stopRequested}
              >
                <div className="pulsing-loader" style={{width: '14px', height: '14px', borderThickness: '2px', borderTopColor: 'white', marginRight: '6px', display: 'inline-block'}}></div>
                <span>{stopRequested ? '正在停止...' : '停止抓取'}</span>
              </button>
            )}

            {comments.length > 0 && (
              <button className="btn-secondary" onClick={handleReset} disabled={isCrawling}>
                <RotateCcw size={15} />
                <span>清空当前数据</span>
              </button>
            )}
          </div>

          {/* Export Panel */}
          {comments.length > 0 && (
            <div className="export-panel">
              <label className="input-label" style={{marginBottom: '4px'}}>导出筛选后数据 ({comments.length} 条)</label>
              <div style={{display: 'flex', gap: '10px'}}>
                <button className="btn-secondary" style={{flex: 1}} onClick={handleExportExcel}>
                  <FileSpreadsheet size={16} className="text-success" />
                  <span>Excel 格式</span>
                </button>
                <button className="btn-secondary" style={{flex: 1}} onClick={handleExportCSV}>
                  <FileText size={16} className="text-accent" />
                  <span>CSV 格式</span>
                </button>
              </div>
              {/* Save to Database Button */}
              <button 
                className="btn-primary" 
                style={{
                  marginTop: '10px', 
                  width: '100%',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)'
                }}
                onClick={handleSaveToDatabase}
                disabled={isSavingToDb || isCrawling}
              >
                {isSavingToDb ? (
                  <>
                    <Loader2 size={16} style={{animation: 'spin 1s linear infinite'}} />
                    <span>正在保存到数据库...</span>
                  </>
                ) : (
                  <>
                    <Database size={16} />
                    <span>💾 保存到数据库 ({comments.length} 条)</span>
                  </>
                )}
              </button>
              {dbSaveResult && (
                <div style={{
                  marginTop: '6px', 
                  fontSize: '0.72rem', 
                  color: '#10b981', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <Save size={12} />
                  <span>
                    已入库 {dbSaveResult.insertedComments || 0} 条 | 
                    跳过重复 {dbSaveResult.skippedComments || 0} 条 |
                    关联视频 {dbSaveResult.videosProcessed || 0} 个
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Progress / Status display */}
          {(isCrawling || progressText) && (
            <div style={{marginTop: '10px', padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', animation: 'fadeIn 0.3s ease'}}>
              <div className="crawling-status-text">
                <span>爬取状态</span>
                <span className="text-primary" style={{fontWeight: 'bold'}}>
                  {fetchedCount}{totalEstimated > 0 ? ` / ~${totalEstimated}` : ''} 条
                </span>
              </div>
              <div className="crawler-progress-bar">
                <div className="crawler-progress-fill" style={{width: `${percentProgress}%`}}></div>
              </div>
              <p style={{fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '8px', lineHeight: '1.4', wordBreak: 'break-all'}}>
                {progressText}
              </p>

              {/* Dynamic Concurrency Thread Board */}
              {activeWorkers && activeWorkers.length > 0 && (
                <div className="thread-board" style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.08)'}}>
                  <div style={{fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <span>🧵 并发采集线程实时看板 ({activeWorkers.length} 线程)</span>
                  </div>
                  <div className="thread-grid">
                    {activeWorkers.map((worker) => (
                      <div className={`thread-card ${worker.status}`} key={worker.id}>
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', overflow: 'hidden'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px'}}>
                            <div className={`thread-indicator ${worker.status}`}></div>
                            <span style={{fontSize: '0.72rem', fontWeight: 'bold', color: worker.status === 'working' ? '#00f2fe' : 'rgba(255,255,255,0.3)', flexShrink: 0}}>
                              线程 {worker.id}
                            </span>
                            <span style={{fontSize: '0.72rem', color: worker.status === 'working' ? 'white' : 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={worker.videoTitle}>
                              {worker.videoTitle}
                            </span>
                          </div>
                          {worker.status === 'working' && worker.fetchedCount > 0 && (
                            <span style={{fontSize: '0.7rem', color: '#00f2fe', fontWeight: 'bold', flexShrink: 0}}>
                              +{worker.fetchedCount} 条
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Content Panel - Displays comments list and statistical analysis */}
        <section className="main-panel">
          
          {/* Notification toast */}
          {notification && (
            <div className={`notification-toast glass-card ${notification.type}`} style={{
              position: 'fixed',
              top: '24px',
              right: '40px',
              zIndex: 9999,
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderLeft: `4px solid var(--color-${notification.type})`,
              animation: 'fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <AlertCircle size={20} style={{color: `var(--color-${notification.type})`}} />
              <span style={{fontSize: '0.9rem', fontWeight: '500'}}>{notification.message}</span>
            </div>
          )}

          {/* Active Video Header Details */}
          {videoInfo && (
            <div className="glass-card video-card">
              {videoInfo.cover && (
                <div className="video-cover-container">
                  <img src={videoInfo.cover} className="video-cover" alt="Video cover" />
                </div>
              )}
              <div className="video-details">
                <div>
                  <h1 className="video-title">{videoInfo.title}</h1>
                  <div className="video-author">
                    {videoInfo.authorAvatar && (
                      <img src={videoInfo.authorAvatar} className="author-avatar" alt="Author avatar" />
                    )}
                    <span>@ {videoInfo.authorName}</span>
                    <span style={{color: 'rgba(255,255,255,0.1)'}}>|</span>
                    <span style={{fontFamily: 'monospace', fontSize: '0.8rem'}}>首个作品ID: {videoInfo.awemeId}</span>
                  </div>
                </div>
                
                <div className="video-stats">
                  <div className="stat-item">
                    <ThumbsUp size={14} />
                    <span>点赞: {formatNumber(videoInfo.likes)}</span>
                  </div>
                  <div className="stat-item">
                    <MessageSquare size={14} />
                    <span>评论: {formatNumber(videoInfo.commentsCount)}</span>
                  </div>
                  <div className="stat-item">
                    <Clock size={14} />
                    <span>已保留: {fetchedCount} 条</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Dashboard Tabs Content */}
          {(comments.length > 0 || activeTab === 'database') ? (
            <div className="glass-card" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
              {/* Tab Navigation header */}
              <div className="tabs-header">
                <button 
                  className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
                  onClick={() => setActiveTab('comments')}
                >
                  <MessageSquare size={16} />
                  <span>数据集 ({renderedComments.length})</span>
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
                  onClick={() => setActiveTab('insights')}
                >
                  <BarChart2 size={16} />
                  <span>深度数据洞察 (统计图表)</span>
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('database');
                    fetchDbStats();
                    fetchDbVideos();
                    fetchDbTasks();
                  }}
                >
                  <Database size={16} />
                  <span>数据库查询</span>
                </button>
              </div>

              {/* Tab Content Panels */}
              <div className="tabs-content">
                {/* 1. Comments list view with filters */}
                {activeTab === 'comments' && (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                    
                    {/* Search & Sort Panel */}
                    <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
                      <div style={{position: 'relative', flex: 1, minWidth: '260px'}}>
                        <Search size={16} style={{position: 'absolute', left: '14px', top: '14px', color: 'var(--color-text-muted)'}} />
                        <input 
                          type="text" 
                          className="input-field" 
                          style={{paddingLeft: '40px', borderRadius: '50px', backgroundColor: 'rgba(255,255,255,0.02)'}}
                          placeholder="搜索用户名、评论内容、IP属地或视频ID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <span style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>排序方式</span>
                        <select 
                          className="input-field" 
                          style={{width: '140px', borderRadius: '50px', padding: '8px 16px', fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.02)'}}
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value)}
                        >
                          <option value="likes">点赞数最高</option>
                          <option value="time">最新发表</option>
                        </select>
                      </div>
                    </div>

                    {/* Feed item list */}
                    <div className="comments-list">
                      {renderedComments.length > 0 ? (
                        renderedComments.map((c) => (
                          <div className="comment-card" key={String(c.cid)}>
                            {c.user?.avatar_thumb?.url_list?.[0] ? (
                              <img src={c.user.avatar_thumb.url_list[0]} className="commenter-avatar" alt="Avatar" />
                            ) : (
                              <div className="commenter-avatar" style={{backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justify: 'center', color: 'var(--color-text-muted)'}}>
                                <User size={18} />
                              </div>
                            )}
                            
                            <div className="comment-main">
                              <div className="comment-header">
                                <span className="comment-author-name">{c.user?.nickname || '匿名用户'}</span>
                                <span className="comment-date">{formatTimestamp(c.create_time)}</span>
                              </div>
                              <p className="comment-text">{c.text}</p>
                              
                              <div className="comment-footer">
                                <div className="comment-action like">
                                  <ThumbsUp size={12} />
                                  <span>{c.digg_count || 0} 个点赞</span>
                                </div>
                                
                                {c.ip_label && (
                                  <div className="comment-action" style={{cursor: 'default'}}>
                                    <MapPin size={12} />
                                    <span>IP属地: {c.ip_label}</span>
                                  </div>
                                )}
                                
                                {c.video_id && (
                                  <div 
                                    className={`comment-action video-link-btn ${hasExtension ? 'extension-linked' : ''}`}
                                    style={{
                                      cursor: 'pointer', 
                                      backgroundColor: hasExtension ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255,44,85,0.08)', 
                                      padding: '2px 8px', 
                                      borderRadius: '4px', 
                                      border: hasExtension ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid rgba(255,44,85,0.15)',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => handleJumpToComment(c)}
                                    title={hasExtension ? "通过浏览器助手精准定位此评论" : "点击跳转到抖音作品页面并查看评论区"}
                                  >
                                    <Video size={10} style={{
                                      marginRight: '3px', 
                                      display: 'inline-block', 
                                      color: hasExtension ? '#00f2fe' : 'var(--color-primary)'
                                    }} />
                                    <span style={{
                                      color: hasExtension ? '#00f2fe' : 'var(--color-primary)', 
                                      fontSize: '0.72rem',
                                      fontWeight: hasExtension ? 'bold' : 'normal'
                                    }}>{hasExtension ? '🔌 自动精准定位' : '跳转评论区 ↗'}</span>
                                  </div>
                                )}
                              </div>

                              {/* Nested replies if available (safely deduplicated by reply.cid) */}
                              {c.reply_comment && c.reply_comment.length > 0 && (
                                <div className="comment-replies">
                                  {(() => {
                                    const seenReplyIds = new Set();
                                    return c.reply_comment
                                      .filter((reply) => {
                                        if (!reply || !reply.cid) return false;
                                        const rId = String(reply.cid).trim();
                                        if (seenReplyIds.has(rId)) return false;
                                        seenReplyIds.add(rId);
                                        return true;
                                      })
                                      .map((reply) => (
                                        <div className="reply-card" key={`${String(c.cid)}-reply-${String(reply.cid)}`}>
                                          <div className="comment-main">
                                            <div className="comment-header">
                                              <span className="comment-author-name" style={{fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)'}}>
                                                {reply.user?.nickname || '未知回复者'}
                                              </span>
                                              <span className="comment-date" style={{fontSize: '0.7rem'}}>
                                                {formatTimestamp(reply.create_time)}
                                              </span>
                                            </div>
                                            <p className="comment-text" style={{fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)'}}>
                                              {reply.text}
                                            </p>
                                            <div className="comment-footer" style={{fontSize: '0.75rem'}}>
                                              <div className="comment-action like">
                                                <ThumbsUp size={10} />
                                                <span>{reply.digg_count || 0}</span>
                                              </div>
                                              {reply.ip_label && (
                                                <div style={{display: 'flex', alignItems: 'center'}}>
                                                  <MapPin size={10} style={{marginRight: '2px', display: 'inline-block'}} />
                                                  <span>{reply.ip_label}</span>
                                                </div>
                                              )}
                                              {c.video_id && (
                                                <div 
                                                  className={`comment-action video-link-btn ${hasExtension ? 'extension-linked' : ''}`}
                                                  style={{
                                                    cursor: 'pointer', 
                                                    backgroundColor: hasExtension ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255,44,85,0.08)', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    border: hasExtension ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid rgba(255,44,85,0.15)',
                                                    transition: 'all 0.2s ease',
                                                    marginLeft: 'auto'
                                                  }}
                                                  onClick={() => handleJumpToComment(reply, c.video_id)}
                                                  title={hasExtension ? "通过浏览器助手精准定位此回复" : "点击跳转到抖音作品页面并查看评论区"}
                                                >
                                                  <Video size={10} style={{
                                                    marginRight: '3px', 
                                                    display: 'inline-block', 
                                                    color: hasExtension ? '#00f2fe' : 'var(--color-primary)'
                                                  }} />
                                                  <span style={{
                                                    color: hasExtension ? '#00f2fe' : 'var(--color-primary)', 
                                                    fontSize: '0.68rem',
                                                    fontWeight: hasExtension ? 'bold' : 'normal'
                                                  }}>{hasExtension ? '🎯 精准定位' : '定位 ↗'}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ));
                                  })()}
                                </div>
                              )}

                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">
                          <AlertCircle size={40} style={{opacity: 0.3}} />
                          <p>未找到符合检索条件的评论，请尝试更换关键词。</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Statistical Analysis Dashboard tab */}
                {activeTab === 'insights' && insights && (
                  <div className="analytics-grid">
                    
                    {/* Key Stats Cards */}
                    <div className="chart-card" style={{gridColumn: '1 / -1', minHeight: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px'}}>
                      <div style={{padding: '16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <span style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>筛选收集总量</span>
                        <span style={{fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--color-primary)'}}>{comments.length}</span>
                      </div>
                      <div style={{padding: '16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <span style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>点赞互动总量</span>
                        <span style={{fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--color-secondary)'}}>{formatNumber(insights.totalLikes)}</span>
                      </div>
                      <div style={{padding: '16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <span style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>平均点赞数 / 条</span>
                        <span style={{fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'white'}}>{insights.avgLikes}</span>
                      </div>
                      <div style={{padding: '16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <span style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>有回复的评论比例</span>
                        <span style={{fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--color-accent)'}}>{insights.hasRepliesPercent}%</span>
                      </div>
                    </div>

                    {/* Word Cloud/Frequency Chart */}
                    <div className="chart-card">
                      <h3 className="chart-title">
                        <TrendingUp size={16} className="text-secondary" />
                        <span>评论热词词频统计 top 10</span>
                      </h3>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', flex: 1}}>
                        {insights.keywords.length > 0 ? (
                          insights.keywords.map((kw, i) => {
                            const maxCount = insights.keywords[0].count;
                            const pct = Math.round((kw.count / maxCount) * 100);
                            return (
                              <div key={`${kw.word || 'kw'}-${i}`} style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                <span style={{width: '24px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontFamily: 'monospace'}}>#{i+1}</span>
                                <span style={{width: '70px', fontSize: '0.85rem', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>{kw.word}</span>
                                <div style={{flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '50px', overflow: 'hidden'}}>
                                  <div style={{height: '100%', width: `${pct}%`, background: 'linear-gradient(to right, var(--color-secondary), var(--color-accent))', borderRadius: '50px'}}></div>
                                </div>
                                <span style={{width: '40px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>{kw.count}次</span>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)'}}>未能提取足够有效的关键词，可能是评论太短。</div>
                        )}
                      </div>
                    </div>

                    {/* IP Location Distribution */}
                    <div className="chart-card">
                      <h3 className="chart-title">
                        <MapPin size={16} className="text-primary" />
                        <span>评论用户 IP 属地分布 top 8</span>
                      </h3>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', flex: 1}}>
                        {insights.ipDistribution.length > 0 ? (
                          insights.ipDistribution.map((ip, i) => {
                            const maxCount = insights.ipDistribution[0].count;
                            const pct = Math.round((ip.count / maxCount) * 100);
                            return (
                              <div key={`${ip.label || 'ip'}-${i}`} style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                <span style={{width: '24px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontFamily: 'monospace'}}>#{i+1}</span>
                                <span style={{width: '70px', fontSize: '0.85rem', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>{ip.label}</span>
                                <div style={{flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '50px', overflow: 'hidden'}}>
                                  <div style={{height: '100%', width: `${pct}%`, background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))', borderRadius: '50px'}}></div>
                                </div>
                                <span style={{width: '40px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>{ip.count}人</span>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)'}}>没有位置属地数据。</div>
                        )}
                      </div>
                    </div>

                    {/* Top Comments Highlight */}
                    <div className="chart-card" style={{gridColumn: '1 / -1', minHeight: 'auto'}}>
                      <h3 className="chart-title" style={{color: 'var(--color-primary)'}}>
                        <ThumbsUp size={16} />
                        <span>评论热度之星 (获赞最多评论)</span>
                      </h3>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px'}}>
                        {insights.topComments.map((c) => (
                          <div key={`top-comment-${String(c.cid)}`} style={{padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,44,85, 0.02)', display: 'flex', gap: '16px', alignItems: 'center'}}>
                            <div style={{width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,44,85,0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem'}}>
                              🏆
                            </div>
                            <div style={{flex: 1}}>
                              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '4px'}}>
                                <span style={{fontWeight: '600', color: 'white'}}>{c.user?.nickname || '匿名创作者'}</span>
                                <span>IP属地: {c.ip_label || '未知'} | {formatTimestamp(c.create_time)}</span>
                              </div>
                              <p style={{fontSize: '0.88rem', color: 'var(--color-text-main)', lineHeight: '1.4'}}>{c.text}</p>
                              {c.video_id && (
                                <div style={{fontSize: '0.7rem', color: 'var(--color-primary)', marginTop: '4px'}}>
                                  来源视频 ID: {c.video_id}
                                </div>
                              )}
                            </div>
                            <div style={{textAlign: 'right', color: 'var(--color-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', padding: '6px 12px', borderRadius: '50px', backgroundColor: 'rgba(255,44,85,0.05)'}}>
                              <ThumbsUp size={12} />
                              <span>{c.digg_count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

                {/* 3. Database Query Tab */}
                {activeTab === 'database' && (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    
                    {/* DB Stats Summary */}
                    {dbStats && (
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px'}}>
                        <div style={{padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                          <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>数据库评论总量</span>
                          <span style={{fontSize: '1.6rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#10b981'}}>{formatNumber(dbStats.totalComments || 0)}</span>
                        </div>
                        <div style={{padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(0, 242, 254, 0.06)', border: '1px solid rgba(0, 242, 254, 0.15)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                          <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>已收录视频数</span>
                          <span style={{fontSize: '1.6rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#00f2fe'}}>{dbStats.totalVideos || 0}</span>
                        </div>
                        <div style={{padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255, 44, 85, 0.06)', border: '1px solid rgba(255, 44, 85, 0.15)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                          <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>累计点赞互动</span>
                          <span style={{fontSize: '1.6rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--color-primary)'}}>{formatNumber(dbStats.totalLikes || 0)}</span>
                        </div>
                      </div>
                    )}

                    {/* Search & Filter Controls */}
                    <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end'}}>
                      <div style={{flex: 2, minWidth: '200px'}}>
                        <label style={{fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block'}}>全文搜索评论内容</label>
                        <div style={{position: 'relative'}}>
                          <Search size={14} style={{position: 'absolute', left: '12px', top: '12px', color: 'var(--color-text-muted)'}} />
                          <input 
                            type="text" 
                            className="input-field" 
                            style={{paddingLeft: '36px', borderRadius: '50px', fontSize: '0.85rem'}}
                            placeholder="输入关键词搜索评论 (支持中文全文检索)..."
                            value={dbSearchQuery}
                            onChange={(e) => setDbSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchDbComments(1)}
                          />
                        </div>
                      </div>
                      <div style={{flex: 1, minWidth: '120px'}}>
                        <label style={{fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block'}}>IP属地筛选</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          style={{borderRadius: '50px', fontSize: '0.85rem'}}
                          placeholder="如: 广东"
                          value={dbSearchIp}
                          onChange={(e) => setDbSearchIp(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && fetchDbComments(1)}
                        />
                      </div>
                      <div style={{flex: 1, minWidth: '120px'}}>
                        <label style={{fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block'}}>排序方式</label>
                        <select 
                          className="input-field" 
                          style={{borderRadius: '50px', fontSize: '0.85rem', padding: '10px 14px'}}
                          value={dbSortOrder}
                          onChange={(e) => { setDbSortOrder(e.target.value); }}
                        >
                          <option value="digg_count">点赞数最高</option>
                          <option value="create_time">最新评论</option>
                          <option value="created_at">入库时间</option>
                        </select>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{height: '44px', borderRadius: '50px', padding: '0 24px', background: 'linear-gradient(135deg, #10b981, #059669)'}}
                        onClick={() => fetchDbComments(1)}
                        disabled={dbIsLoading}
                      >
                        {dbIsLoading ? <Loader2 size={16} style={{animation: 'spin 1s linear infinite'}} /> : <Search size={16} />}
                        <span>查询</span>
                      </button>
                    </div>

                    {/* Video filter dropdown */}
                    {dbVideos.length > 0 && (
                      <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                        <label style={{fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap'}}>按视频筛选:</label>
                        <select 
                          className="input-field" 
                          style={{flex: 1, borderRadius: '50px', fontSize: '0.8rem', padding: '8px 14px'}}
                          value={dbSearchVideoId}
                          onChange={(e) => setDbSearchVideoId(e.target.value)}
                        >
                          <option value="">全部视频</option>
                          {dbVideos.map(v => (
                            <option key={v.aweme_id} value={v.aweme_id}>
                              [{v.aweme_id}] {(v.title || '').substring(0, 40)} ({v.comments_count || 0}条评论)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Results Info Bar */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0 4px'}}>
                      <span>共检索到 <strong style={{color: '#10b981'}}>{dbTotalCount.toLocaleString()}</strong> 条结果</span>
                      <span>第 {dbPage} / {Math.max(1, Math.ceil(dbTotalCount / dbPageSize))} 页</span>
                    </div>

                    {/* Database Comment List */}
                    <div className="comments-list">
                      {dbIsLoading ? (
                        <div className="empty-state" style={{minHeight: '200px'}}>
                          <Loader2 size={32} style={{animation: 'spin 1s linear infinite', color: '#10b981'}} />
                          <p>正在查询数据库...</p>
                        </div>
                      ) : dbComments.length > 0 ? (
                        dbComments.map((c) => (
                          <div className="comment-card" key={`db-${c.cid || c.id}`}>
                            <div className="commenter-avatar" style={{backgroundColor: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981'}}>
                              <User size={18} />
                            </div>
                            <div className="comment-main">
                              <div className="comment-header">
                                <span className="comment-author-name">{c.user_nickname || '匿名用户'}</span>
                                <span className="comment-date">{formatTimestamp(c.create_time)}</span>
                              </div>
                              <p className="comment-text">{c.text}</p>
                              <div className="comment-footer">
                                <div className="comment-action like">
                                  <ThumbsUp size={12} />
                                  <span>{c.digg_count || 0} 个点赞</span>
                                </div>
                                {c.ip_label && (
                                  <div className="comment-action" style={{cursor: 'default'}}>
                                    <MapPin size={12} />
                                    <span>IP: {c.ip_label}</span>
                                  </div>
                                )}
                                {c.aweme_id && (() => {
                                  const videoTitleVal = c.video_title || c.video?.title || '';
                                  const videoDisplayTitle = videoTitleVal ? `视频: ${videoTitleVal}` : `视频 ${c.aweme_id}`;
                                  const displayTitleShort = videoDisplayTitle.length > 22 ? videoDisplayTitle.substring(0, 22) + '...' : videoDisplayTitle;
                                  return (
                                    <div 
                                      className={`comment-action video-link-btn ${hasExtension ? 'extension-linked' : ''}`}
                                      style={{
                                        cursor: 'pointer', 
                                        backgroundColor: hasExtension ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255,44,85,0.08)', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px', 
                                        border: hasExtension ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid rgba(255,44,85,0.15)',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                      onClick={() => handleJumpToComment(c)}
                                      title={hasExtension 
                                        ? `通过浏览器助手精准定位此评论${videoTitleVal ? ` (来自视频: ${videoTitleVal})` : ''}` 
                                        : `点击跳转到抖音作品页面并查看评论区${videoTitleVal ? ` (来自视频: ${videoTitleVal})` : ''}`
                                      }
                                    >
                                      <Video size={10} style={{
                                        display: 'inline-block', 
                                        color: hasExtension ? '#00f2fe' : 'var(--color-primary)'
                                      }} />
                                      <span style={{
                                        color: hasExtension ? '#00f2fe' : 'var(--color-primary)', 
                                        fontSize: '0.72rem',
                                        fontWeight: hasExtension ? 'bold' : 'normal'
                                      }}>
                                        {hasExtension ? '🔌 自动精准定位' : `${displayTitleShort} ↗`}
                                      </span>
                                    </div>
                                  );
                                })()}
                                <div 
                                  className="comment-action" 
                                  style={{cursor: 'pointer', marginLeft: 'auto', color: 'var(--color-danger)', opacity: 0.5}}
                                  onClick={() => handleDbDeleteComment(c.cid)}
                                  title="从数据库中删除此评论"
                                >
                                  <Trash2 size={12} />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state" style={{minHeight: '200px'}}>
                          <Database size={40} style={{opacity: 0.3, color: '#10b981'}} />
                          <p>{dbSearchQuery ? '未找到匹配的评论，请尝试其他关键词' : '数据库中暂无评论数据，请先爬取并保存'}</p>
                        </div>
                      )}
                    </div>

                    {/* Pagination Controls */}
                    {dbTotalCount > dbPageSize && (
                      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '12px 0'}}>
                        <button 
                          className="btn-secondary" 
                          style={{padding: '8px 16px', borderRadius: '50px', fontSize: '0.8rem'}}
                          onClick={() => fetchDbComments(dbPage - 1)}
                          disabled={dbPage <= 1 || dbIsLoading}
                        >
                          <ChevronLeft size={14} />
                          <span>上一页</span>
                        </button>
                        <div style={{display: 'flex', gap: '4px'}}>
                          {(() => {
                            const totalPages = Math.ceil(dbTotalCount / dbPageSize);
                            const pages = [];
                            let start = Math.max(1, dbPage - 2);
                            let end = Math.min(totalPages, start + 4);
                            if (end - start < 4) start = Math.max(1, end - 4);
                            for (let i = start; i <= end; i++) {
                              pages.push(
                                <button
                                  key={`page-${i}`}
                                  style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    border: i === dbPage ? '2px solid #10b981' : '1px solid var(--border-color)',
                                    backgroundColor: i === dbPage ? 'rgba(16,185,129,0.15)' : 'transparent',
                                    color: i === dbPage ? '#10b981' : 'var(--color-text-muted)',
                                    fontSize: '0.8rem', fontWeight: i === dbPage ? 'bold' : 'normal',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                  onClick={() => fetchDbComments(i)}
                                  disabled={dbIsLoading}
                                >
                                  {i}
                                </button>
                              );
                            }
                            return pages;
                          })()}
                        </div>
                        <button 
                          className="btn-secondary" 
                          style={{padding: '8px 16px', borderRadius: '50px', fontSize: '0.8rem'}}
                          onClick={() => fetchDbComments(dbPage + 1)}
                          disabled={dbPage >= Math.ceil(dbTotalCount / dbPageSize) || dbIsLoading}
                        >
                          <span>下一页</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}

                    {/* Task History Section */}
                    {dbTasks.length > 0 && (
                      <div style={{marginTop: '8px', padding: '16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)'}}>
                        <h3 style={{fontSize: '0.85rem', fontWeight: '600', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px'}}>
                          <History size={14} style={{color: '#10b981'}} />
                          <span>最近采集任务记录</span>
                        </h3>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                          {dbTasks.slice(0, 5).map((task) => (
                            <div key={task.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)',
                              fontSize: '0.8rem'
                            }}>
                              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '600',
                                  backgroundColor: task.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: task.status === 'completed' ? '#10b981' : '#f59e0b'
                                }}>
                                  {task.status === 'completed' ? '已完成' : task.status === 'running' ? '进行中' : task.status}
                                </span>
                                <span style={{color: 'var(--color-text-muted)'}}>{task.task_type === 'search' ? '🔍 关键词搜索' : '🔗 链接批量'}</span>
                              </div>
                              <div style={{display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text-muted)'}}>
                                <span>视频 {task.total_videos}</span>
                                <span style={{color: '#10b981', fontWeight: '600'}}>评论 {task.total_comments}</span>
                                <span style={{fontSize: '0.72rem'}}>{task.started_at ? new Date(task.started_at).toLocaleString('zh-CN') : ''}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Idle State View (Before crawling starts)
            <div className="glass-card empty-state" style={{flex: 1, minHeight: '400px'}}>
              <Video size={48} className="empty-icon" style={{color: 'var(--color-primary)', opacity: 0.6, animation: 'pulseGlow 2s infinite'}} />
              <h2 style={{fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '1.5rem', color: 'white'}}>
                批量爬取抖音评论，开启深度数据探索
              </h2>
              <p style={{maxWidth: '520px', fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: '1.6'}}>
                在左侧控制台中粘贴单个或多个抖音视频链接/作品 ID（支持多行批量输入），亦可指定评论关键词进行精准收集。本平台将通过代理接口对每条评论进行多维度数据汇总与多格式导出。
              </p>
              <div style={{display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.8rem', color: 'var(--color-text-muted)', flexWrap: 'wrap', justifyContent: 'center'}}>
                <span className="stat-item">📋 评论关键词内容过滤</span>
                <span className="stat-item">⛓️ 批量多视频流式收集</span>
                <span className="stat-item">🔑 唯一Key消除，完美避开重复</span>
              </div>
              <button 
                className="btn-secondary" 
                style={{marginTop: '20px', padding: '12px 28px', borderRadius: '50px', fontSize: '0.9rem', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981'}}
                onClick={() => {
                  setActiveTab('database');
                  fetchDbStats();
                  fetchDbVideos();
                  fetchDbTasks();
                }}
              >
                <Database size={18} />
                <span>打开数据库查询</span>
              </button>
            </div>
          )}

        </section>
      </main>
    </div>
  );
}

export default App;
