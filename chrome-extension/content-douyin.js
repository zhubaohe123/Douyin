// 抖音评论定位助手 - 抖音页面精准滚动高亮定位脚本

console.log('%c[抖音评论定位助手] 抖音自动化脚本已载入！', 'color: #00f2fe; font-weight: bold;');

// 获取当前 URL 里的视频 ID
const getActiveVideoId = () => {
  const match = window.location.pathname.match(/\/video\/(\d+)/) || window.location.pathname.match(/\/note\/(\d+)/);
  return match ? match[1] : null;
};

// 注入自定义高亮样式
const injectHighlightStyles = () => {
  if (document.getElementById('douyin-locator-styles')) return;
  const style = document.createElement('style');
  style.id = 'douyin-locator-styles';
  style.textContent = `
    @keyframes commentPulseGlow {
      0% { box-shadow: 0 0 4px rgba(0, 242, 254, 0.4); border-color: rgba(0, 242, 254, 0.4); }
      50% { box-shadow: 0 0 15px rgba(0, 242, 254, 0.85); border-color: #00f2fe; }
      100% { box-shadow: 0 0 4px rgba(0, 242, 254, 0.4); border-color: rgba(0, 242, 254, 0.4); }
    }
    .plugin-target-highlight {
      animation: commentPulseGlow 1s ease-in-out infinite !important;
      border: 2px solid #00f2fe !important;
      border-radius: 8px !important;
      transition: all 0.3s ease !important;
      background-color: rgba(0, 242, 254, 0.08) !important;
      padding: 6px !important;
    }
  `;
  document.head.appendChild(style);
};

// 精准定位核心函数
const executeLocate = (target) => {
  injectHighlightStyles();
  console.log('[定位助手] 正在执行精准定位，查找目标:', target);

  let attempts = 0;
  const maxAttempts = 80; // 增加尝试次数，约支持持续自动加载滚动 40-50 秒

  // 寻找抖音页面上实际可滚动的评论列表容器
  const findScrollContainer = () => {
    // 1. 尝试使用抖音官方的 e2e 标志匹配评论列表
    let container = document.querySelector('[data-e2e="comment-list"]');
    if (container) return container;

    // 2. 尝试常见类名查找
    container = document.querySelector('[class*="comment-list"], [class*="CommentList"], [class*="comment_list"]');
    if (container) return container;

    // 3. 动态爬树算法：从已渲染的任意评论项向上寻找首个具有滚动条属性（且 scrollHeight > clientHeight）的父节点
    const anyComment = document.querySelector('[data-e2e="comment-item"], [class*="comment-item"], [class*="commentItem"]');
    if (anyComment) {
      let parent = anyComment.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' || parent.scrollHeight > parent.clientHeight) {
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    // 4. 兜底匹配侧边栏大容器（部分剧场模式）
    const rightPanel = document.querySelector('[class*="right-container"], [class*="sidebar"], [class*="aside"]');
    if (rightPanel) return rightPanel;

    return null;
  };

  const checkAndScroll = () => {
    attempts++;
    
    // 尝试找到所有的标签节点
    const allDivs = document.querySelectorAll('div, [data-e2e="comment-item"]');
    let matchedElement = null;

    for (let el of allDivs) {
      const textContent = el.textContent || '';
      
      // 鲁棒性匹配：查找页面中同时包含作者 nickname 以及评论文本特征的 DOM 节点
      if (target.nickname && textContent.includes(target.nickname) && 
          target.text && textContent.includes(target.text.slice(0, 8))) {
        
        // 确保匹配的是最内层的评论卡片，而不是它的滚动容器
        if (!matchedElement || el.textContent.length < matchedElement.textContent.length) {
          matchedElement = el;
        }
      }
    }

    if (matchedElement) {
      console.log('[定位助手] 成功定位到评论节点！正在滚动高亮...', matchedElement);
      
      // 滚动至屏幕正中
      matchedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 添加酷炫的青蓝色呼吸灯高亮框
      matchedElement.classList.add('plugin-target-highlight');
      
      // 5秒后移除高亮特效
      setTimeout(() => {
        matchedElement.classList.remove('plugin-target-highlight');
      }, 5000);

      // 清除后台的 pending 状态，防二次误触发
      chrome.runtime.sendMessage({
        type: 'CLEAR_PENDING_COMMENT',
        videoId: target.videoId
      });
      return true;
    }

    // 如果当前页面没找到，自动触发向下翻页（通过滚动容器触底）
    if (attempts < maxAttempts) {
      const scrollContainer = findScrollContainer();
      if (scrollContainer) {
        console.log('[定位助手] 未寻得目标评论，正在自动滚动该容器以加载下一页评论:', scrollContainer);
        // 直接滚到底部，触发抖音的 Lazy Load 加载事件
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      } else {
        console.log('[定位助手] 未检测到局部滚动容器，正在兜底滚动全局窗口');
        window.scrollBy(0, 600);
      }

      // 给网络加载与 DOM 渲染留出 600ms 时间
      setTimeout(checkAndScroll, 600);
    } else {
      console.warn('[定位助手] 达到最大搜索尝试次数，已停止自动滚动。请手动下滑。');
    }
  };

  // 延迟 1.5 秒启动，确保页面首屏数据加载完成
  setTimeout(checkAndScroll, 1500);
};

// 页面初始化加载逻辑
const init = () => {
  const videoId = getActiveVideoId();
  if (!videoId) return;

  console.log('[定位助手] 当前视频 ID:', videoId, '，开始检查是否有挂起定位请求...');
  
  // 向后台查询
  chrome.runtime.sendMessage({
    type: 'GET_PENDING_COMMENT',
    videoId: videoId
  }, (response) => {
    if (response && response.data) {
      executeLocate(response.data);
    }
  });
};

// 运行初始化
init();

// 监听抖音 SPA 页面内无刷新切换视频的情形 (利用 URL 变更感知)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('[定位助手] 检测到 URL 发生变更，重新触发初始化检测...');
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });
