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
  const maxAttempts = 30; // 轮询等待，持续约 15 秒

  const checkAndScroll = () => {
    attempts++;
    
    // 尝试找到所有的标签节点
    const allDivs = document.querySelectorAll('div, [data-e2e="comment-item"]');
    let matchedElement = null;

    for (let el of allDivs) {
      const textContent = el.textContent || '';
      
      // 方法：查找页面中同时包含作者 nickname 以及评论文本特征的 DOM 节点
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

    // 如果没找到，尝试向下微滚一下评论抽屉，以触发抖音懒加载
    if (attempts < maxAttempts) {
      // 抖音的评论大容器滚动区域
      const commentDrawer = document.querySelector('[class*="comment-list"], [class*="CommentList"], [class*="drawer"]');
      if (commentDrawer) {
        commentDrawer.scrollTop += 200;
      } else {
        window.scrollBy(0, 200);
      }

      setTimeout(checkAndScroll, 500);
    } else {
      console.warn('[定位助手] 未能自动定位到评论，可能是评论数据还在加载中，请尝试手动向下滚动以加载数据。');
    }
  };

  // 延迟启动，给抖音页面渲染多一点时间
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
