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
  let noCommentAttempts = 0;
  const maxNoCommentAttempts = 15; // 约支持等待和主动触发 12 秒

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
      while (parent && parent !== document.body && parent !== document.documentElement) {
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

    // 5. 如果已经存在评论项，但是没有找到局部滚动容器，代表是整页滚动的传统布局，返回 window 作为滚动容器
    if (anyComment) {
      return window;
    }

    return null;
  };

  const checkAndScroll = () => {
    // 1. 检查首条评论是否已在 DOM 中渲染
    const anyComment = document.querySelector('[data-e2e="comment-item"], [class*="comment-item"], [class*="commentItem"]');
    
    if (!anyComment) {
      noCommentAttempts++;
      console.log(`[定位助手] 尚未检测到已渲染的评论项 (第 ${noCommentAttempts}/${maxNoCommentAttempts} 次等待)...`);
      
      if (noCommentAttempts < maxNoCommentAttempts) {
        // 主动尝试唤醒评论区！
        // a. 尝试发现并点击“评论”按钮
        const commentButtons = document.querySelectorAll(
          '[data-e2e="feed-comment-icon"], [data-e2e="comment-icon"], [class*="comment-icon"], [class*="commentIcon"], [class*="comment-btn"], [class*="commentBtn"]'
        );
        for (let btn of commentButtons) {
          if (btn && typeof btn.click === 'function') {
            console.log('[定位助手] 发现疑似评论区按钮，尝试自动点击打开评论面板...', btn);
            btn.click();
            break;
          }
        }

        // b. 自动微量下滑页面/窗口，触发抖音的懒加载机制
        console.log('[定位助手] 正在微调页面滚动，以触发评论组件加载...');
        window.scrollBy({ top: 300, behavior: 'smooth' });

        setTimeout(checkAndScroll, 800);
      } else {
        console.warn('[定位助手] 持续等待评论渲染超时，停止尝试。请手动打开评论区或下滑页面。');
      }
      return;
    }

    // 2. 寻找可滚动的评论容器
    const scrollContainer = findScrollContainer();
    if (!scrollContainer) {
      console.log('[定位助手] 评论容器尚未完全就绪，静候就绪...');
      setTimeout(checkAndScroll, 800);
      return;
    }

    attempts++;
    console.log(`[定位助手] 正在进行第 ${attempts}/${maxAttempts} 次定位检索...`);
    
    // 尝试找到所有的评论节点
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
      console.log('[定位助手] 🎯 成功匹配并定位到评论节点！正在滚动高亮...', matchedElement);
      
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

    // 如果当前页面没找到，自动触发向下翻页
    if (attempts < maxAttempts) {
      console.log('[定位助手] 当前已渲染列表中无匹配评论，自动触底拉取下一页数据...');
      
      if (scrollContainer === window) {
        // 整页滚动
        window.scrollBy({ top: 600, behavior: 'smooth' });
      } else {
        // 局部容器滚动触底
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }

      // 给网络加载与 DOM 渲染留出 800ms 时间（整页滚动懒加载稍微慢一点，增加到800ms更稳妥）
      setTimeout(checkAndScroll, 800);
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
