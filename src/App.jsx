import React, { useState, useEffect, useRef } from 'react';
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
  Filter
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

  // Just One API V4 Keyword Search Configuration States
  const [crawlMode, setCrawlMode] = useState('links'); // 'links' or 'search'
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchToken, setSearchToken] = useState('');
  const [searchGateway, setSearchGateway] = useState('cn'); // 'cn' or 'global'
  const [searchSortType, setSearchSortType] = useState('_0'); // '_0' (综合), '_1' (点赞最多), '_2' (最新)
  const [searchPublishTime, setSearchPublishTime] = useState('_0'); // '_0' (不限), '_1' (24h), '_7' (7天), '_180' (6个月)
  const [searchDuration, setSearchDuration] = useState('_0'); // '_0' (不限), '_1' (1min以内), '_2' (1-5min), '_3' (>5min)
  const [searchPages, setSearchPages] = useState(1); // 1 to 5 pages
  
  // Crawler Execution State
  const [isCrawling, setIsCrawling] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [fetchedCount, setFetchedCount] = useState(0);
  const [totalEstimated, setTotalEstimated] = useState(0);
  const [percentProgress, setPercentProgress] = useState(0);

  // Data State
  const [videoInfo, setVideoInfo] = useState(null);
  const [comments, setComments] = useState([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState('comments');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('likes'); // 'likes' or 'time'
  const [notification, setNotification] = useState(null);
  
  // Refs to control crawling loops
  const crawlActiveRef = useRef(false);

  // Auto-dismiss notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
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

  // Resolve videos from keyword search via Just One API (V4)
  const resolveVideosBySearch = async (keyword, token) => {
    if (!keyword.trim()) {
      throw new Error('请输入搜索关键词');
    }
    if (!token.trim()) {
      throw new Error('请输入 Just One API 访问令牌 (Token)');
    }

    const resolvedIds = [];
    let currentSearchId = '';
    const totalPages = parseInt(searchPages, 10) || 1;

    setProgressText(`开始使用 Just One API 进行全网视频搜索，关键词: "${keyword}"...`);

    // Choose active proxy route based on user gateway configuration
    const proxyPrefix = searchGateway === 'cn' ? '/justoneapi-cn' : '/justoneapi-global';

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      if (!crawlActiveRef.current) break;

      setProgressText(`正在搜索作品列表 (第 ${currentPage}/${totalPages} 页)...`);

      // Build endpoint query parameters (using exact V4 parameter naming conventions)
      let queryParams = `token=${encodeURIComponent(token.trim())}&keyword=${encodeURIComponent(keyword.trim())}`;
      queryParams += `&sortType=${searchSortType}`;
      queryParams += `&publishTime=${searchPublishTime}`;
      queryParams += `&duration=${searchDuration}`;
      queryParams += `&page=${currentPage}`;

      if (currentPage > 1 && currentSearchId) {
        queryParams += `&searchId=${encodeURIComponent(currentSearchId)}`;
      }

      const searchUrl = `${proxyPrefix}/api/douyin/search-video/v4?${queryParams}`;

      try {
        const response = await fetch(searchUrl);
        if (!response.ok) {
          throw new Error(`HTTP 异常 ${response.status}`);
        }

        const resData = await response.json();
        
        // According to documentation, code "0" indicates successful business execution
        const businessCode = String(resData.code);
        if (businessCode !== '0') {
          // Handle error codes explicitly
          let errorMsg = resData.message || resData.msg || `业务异常 (错误码: ${businessCode})`;
          if (businessCode === '100') errorMsg = 'Token 无效或已失效，请检查您的访问令牌。';
          else if (businessCode === '301') errorMsg = '采集服务器繁忙，请稍后重试。';
          else if (businessCode === '302') errorMsg = '已超出接口调用速率限制。';
          else if (businessCode === '303') errorMsg = '已超出接口每日调用配额。';
          else if (businessCode === '601') errorMsg = '您的 API 余额不足，请充值。';
          throw new Error(errorMsg);
        }

        const searchData = resData.data;
        if (!searchData) {
          break;
        }

        // Keep the returned search_id for chained deep page pagination
        if (searchData.search_id) {
          currentSearchId = searchData.search_id;
        }

        // Support both raw Douyin 'aweme_list' and flat standard 'list' response structures
        const videoList = searchData.aweme_list || searchData.list || [];
        if (videoList.length === 0) {
          setProgressText(`搜索已到底，第 ${currentPage} 页无更多匹配作品`);
          break;
        }

        let pageMatchedCount = 0;
        for (const video of videoList) {
          if (!video) continue;

          // Safely map all possible video/author/statistics variations defensively
          const videoId = String(video.aweme_id || video.video_id || video.id || '');
          if (!videoId) continue;

          const desc = video.desc || video.title || `视频作品 #${videoId}`;

          // Extra validation: Apply client-side video title keyword filter if configured
          const matchesVideoKeyword = !videoKeywordFilter.trim() || 
            desc.toLowerCase().includes(videoKeywordFilter.trim().toLowerCase());

          if (matchesVideoKeyword) {
            resolvedIds.push({
              id: videoId,
              original: `搜索 "${keyword}" 第 ${currentPage} 页 #${videoId}`,
              title: desc,
              cover: video.video?.cover?.url_list?.[0] || video.video?.dynamic_cover?.url_list?.[0] || video.cover || video.cover_url || '',
              authorName: video.author?.nickname || video.author?.name || '抖音创作者',
              authorAvatar: video.author?.avatar_thumb?.url_list?.[0] || video.author?.avatar || video.author?.avatar_url || '',
              likes: video.statistics?.digg_count || video.statistics?.like_count || video.likes || 0,
              commentsCount: video.statistics?.comment_count || video.comments || 0,
              shares: video.statistics?.share_count || video.shares || 0,
              collects: video.statistics?.collect_count || video.collects || 0
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

  // Master Crawl Executor (supporting batch crawl and keywords)
  const startCrawling = async () => {
    if (isCrawling) return;
    
    setIsCrawling(true);
    setStopRequested(false);
    setComments([]);
    setVideoInfo(null);
    setFetchedCount(0);
    setPercentProgress(0);
    setTotalEstimated(0);
    crawlActiveRef.current = true;

    try {
      // 1. Resolve all input IDs or trigger keyword-based search resolution
      let videoList = [];
      if (crawlMode === 'search') {
        videoList = await resolveVideosBySearch(searchKeyword, searchToken);
      } else {
        videoList = await resolveAllAwemeIds(inputUrls);
      }
      showNotification(`解析成功，即将开始抓取 ${videoList.length} 个视频的评论`, 'info');
      
      let allComments = [];
      const fetchLimit = parseInt(maxComments, 10) || 100000;
      
      // Calculate total expected comments if available (sum of all video stats)
      let aggregatedTotalComments = 0;

      for (let vIndex = 0; vIndex < videoList.length && crawlActiveRef.current; vIndex++) {
        const currentVideo = videoList[vIndex];
        setProgressText(`[第 ${vIndex + 1}/${videoList.length} 个视频] 正在加载视频详情 (ID: ${currentVideo.id})...`);
        
        // Load details for current video (optimized if already preloaded)
        let details;
        if (currentVideo.likes !== undefined) {
          details = currentVideo;
        } else {
          details = await fetchSingleVideoDetails(currentVideo.id);
        }

        // Apply video title keyword filter
        const matchesVideoKeyword = !videoKeywordFilter.trim() || 
          (details.title && details.title.toLowerCase().includes(videoKeywordFilter.trim().toLowerCase()));
        
        if (!matchesVideoKeyword) {
          setProgressText(`[视频 ${vIndex + 1}/${videoList.length}] 标题不匹配 "${videoKeywordFilter}"，跳过该作品...`);
          continue;
        }
        
        // Display header for the first or main video
        if (vIndex === 0 || !videoInfo) {
          setVideoInfo(details);
        }
        
        aggregatedTotalComments += details.commentsCount;
        setTotalEstimated(aggregatedTotalComments || (videoList.length * 100));

        let cursor = 0;
        let hasMore = true;
        let videoCommentsFetched = 0;

        while (hasMore && crawlActiveRef.current) {
          // Check global crawl limit
          if (allComments.length >= fetchLimit) {
            break;
          }

          setProgressText(`[视频 ${vIndex + 1}/${videoList.length}] 抓取中... (已获取该视频: ${videoCommentsFetched} 条, 总抓取量: ${allComments.length} 条)`);
          
          const count = 20; // chunk size
          const url = `/api/douyin/web/fetch_video_comments?aweme_id=${currentVideo.id}&cursor=${cursor}&count=${count}`;
          
          const response = await fetch(url);
          if (!response.ok) {
            console.error(`请求第 ${vIndex + 1} 个视频的评论分片失败`);
            break; // Skip to next video or end gracefully
          }
          
          const resData = await response.json();
          if (resData.code !== 200 || !resData.data) {
            console.error(`接口报错:`, resData.msg);
            break;
          }
          
          const cdata = resData.data;
          const commentList = cdata.comments || [];
          
          if (commentList.length === 0) {
            break;
          }

          // Ensure unique elements and apply text keywords filter (strictly normalize string IDs)
          const uniqueCommentsInChunk = [];
          const seenCids = new Set(allComments.map(c => String(c.cid).trim()));
          
          for (const item of commentList) {
            if (item && item.cid) {
              const cidStr = String(item.cid).trim();
              if (!seenCids.has(cidStr)) {
                // Keyword content check (case insensitive)
                const matchesKeyword = !keywordFilter.trim() || 
                  (item.text && item.text.toLowerCase().includes(keywordFilter.trim().toLowerCase()));
                
                if (matchesKeyword) {
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
                  item.video_id = currentVideo.id;
                  item.video_title = details.title;
                  uniqueCommentsInChunk.push(item);
                  seenCids.add(cidStr);
                }
              }
            }
          }

          videoCommentsFetched += commentList.length;
          allComments = [...allComments, ...uniqueCommentsInChunk];
          
          // Re-render dynamic list updates
          setComments(allComments);
          setFetchedCount(allComments.length);
          
          // Next page pointers
          cursor = cdata.cursor || (cursor + commentList.length);
          hasMore = cdata.has_more === 1 || cdata.has_more === true;
          
          // Update progress calculations
          const currentTarget = Math.min(aggregatedTotalComments || fetchLimit, fetchLimit);
          const percent = Math.min(Math.round((allComments.length / currentTarget) * 100), 100);
          setPercentProgress(percent);

          // Delay to prevent getting IP banned and look visually premium
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        // Show a brief break progress note
        if (vIndex < videoList.length - 1 && crawlActiveRef.current) {
          setProgressText(`[视频 ${vIndex + 1} 完成] 休息一下，即将进入下一个视频...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      if (!crawlActiveRef.current) {
        setProgressText('抓取任务被手动终止');
        showNotification('抓取任务已手动中止，数据已暂存', 'warning');
      } else {
        setProgressText(`抓取结束，共成功收集并过滤到 ${allComments.length} 条评论！`);
        showNotification(`完成！共收集并过滤到 ${allComments.length} 条评论数据`, 'success');
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
                  <span>Just One API 访问令牌 (Token)</span>
                </label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="请输入您的 API Key / Token" 
                  value={searchToken}
                  onChange={(e) => setSearchToken(e.target.value)}
                  disabled={isCrawling}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', animation: 'fadeIn 0.3s ease' }}>
                <div className="input-group">
                  <label className="input-label">搜索接口网关</label>
                  <select 
                    className="input-field" 
                    style={{ fontSize: '0.8rem', padding: '10px 12px' }}
                    value={searchGateway}
                    onChange={(e) => setSearchGateway(e.target.value)}
                    disabled={isCrawling}
                  >
                    <option value="cn">大陆加速 (推荐)</option>
                    <option value="global">全球默认 (海外)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">排序标准</label>
                  <select 
                    className="input-field" 
                    style={{ fontSize: '0.8rem', padding: '10px 12px' }}
                    value={searchSortType}
                    onChange={(e) => setSearchSortType(e.target.value)}
                    disabled={isCrawling}
                  >
                    <option value="_0">综合排序</option>
                    <option value="_1">点赞最多</option>
                    <option value="_2">最新发布</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', animation: 'fadeIn 0.3s ease' }}>
                <div className="input-group">
                  <label className="input-label">发布时间</label>
                  <select 
                    className="input-field" 
                    style={{ fontSize: '0.8rem', padding: '10px 12px' }}
                    value={searchPublishTime}
                    onChange={(e) => setSearchPublishTime(e.target.value)}
                    disabled={isCrawling}
                  >
                    <option value="_0">全部时间</option>
                    <option value="_1">最近 24 小时</option>
                    <option value="_7">最近 7 天</option>
                    <option value="_180">最近 6 个月</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">视频时长</label>
                  <select 
                    className="input-field" 
                    style={{ fontSize: '0.8rem', padding: '10px 12px' }}
                    value={searchDuration}
                    onChange={(e) => setSearchDuration(e.target.value)}
                    disabled={isCrawling}
                  >
                    <option value="_0">不限时长</option>
                    <option value="_1">1 分钟以内</option>
                    <option value="_2">1 - 5 分钟</option>
                    <option value="_3">5 分钟以上</option>
                  </select>
                </div>
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
                  <option value={1}>抓取第 1 页 (~10个作品)</option>
                  <option value={2}>抓取前 2 页 (~20个作品)</option>
                  <option value={3}>抓取前 3 页 (~30个作品)</option>
                  <option value={4}>抓取前 4 页 (~40个作品)</option>
                  <option value={5}>抓取前 5 页 (~50个作品 - 深度模式)</option>
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
              placeholder="例如: 好用、质量、买过 (只保留匹配评论)" 
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

          {/* Action buttons */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px'}}>
            {!isCrawling ? (
              <button 
                className="btn-primary" 
                onClick={startCrawling}
                disabled={crawlMode === 'search' ? (!searchKeyword.trim() || !searchToken.trim()) : !inputUrls.trim()}
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
          {comments.length > 0 ? (
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
                                  <div className="comment-action" style={{cursor: 'default', backgroundColor: 'rgba(255,44,85,0.08)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,44,85,0.15)'}}>
                                    <Video size={10} style={{marginRight: '3px', display: 'inline-block'}} />
                                    <span style={{color: 'var(--color-primary)', fontSize: '0.72rem'}}>作品: {c.video_id}</span>
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
                                                <div>
                                                  <MapPin size={10} style={{marginRight: '2px', display: 'inline-block'}} />
                                                  <span>{reply.ip_label}</span>
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
            </div>
          )}

        </section>
      </main>
    </div>
  );
}

export default App;
