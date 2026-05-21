// 抖音评论定位助手 - 采集系统通信脚本
console.log('%c[抖音评论定位助手] 脚本已注入采集系统！', 'color: #00f2fe; font-weight: bold;');

// 1. 在根 documentElement 上挂载属性标记，以便 React 能够通过 DOM 特征直接判定
document.documentElement.dataset.douyinCollectorInstalled = 'true';

// 2. 向页面环境注入全局变量（由于 content script 具有隔离的 JS 上下文，需要通过页面 DOM 节点注入真正的 window 变量）
const injectScript = () => {
  try {
    const script = document.createElement('script');
    script.textContent = `
      window.__DOUYIN_COLLECTOR_EXTENSION_INSTALLED__ = true;
      // 派发就绪自定义事件
      window.dispatchEvent(new CustomEvent('DOUYIN_COLLECTOR_EXT_READY'));
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  } catch (e) {
    console.error('[抖音评论定位助手] 变量注入失败:', e);
  }
};
injectScript();

// 3. 再次向 React 环境发送消息，确保 React 组件加载完成后能接收到
window.addEventListener('load', () => {
  window.dispatchEvent(new CustomEvent('DOUYIN_COLLECTOR_EXT_READY'));
});

// 4. 监听采集系统发出的精准定位事件
window.addEventListener('DOUYIN_COLLECTOR_JUMP_COMMENT', (e) => {
  const payload = e.detail;
  if (!payload || !payload.videoId) return;

  console.log('[抖音评论定位助手] 捕获到定位请求，正在传输给后台服务:', payload);
  
  // 发送给后台 Service Worker 存储跳转目标
  chrome.runtime.sendMessage({
    type: 'SET_PENDING_COMMENT',
    data: payload
  });
});
