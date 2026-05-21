// 抖音评论定位助手 - 后台服务脚本 (Service Worker)

let pendingComments = {}; // 存储待定位的评论数据，以 videoId 作为键名

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. 采集页面存入待定位评论目标
  if (message.type === 'SET_PENDING_COMMENT') {
    const payload = message.data;
    if (payload && payload.videoId) {
      pendingComments[payload.videoId] = payload;
      console.log('[定位助手后台] 已登记待定位目标:', payload);
      sendResponse({ status: 'success' });
    }
  }
  
  // 2. 抖音页面加载后，拉取该视频是否有待定位的评论目标
  if (message.type === 'GET_PENDING_COMMENT') {
    const videoId = message.videoId;
    if (videoId && pendingComments[videoId]) {
      const target = pendingComments[videoId];
      console.log('[定位助手后台] 抖音页面请求定位数据，成功分发:', target);
      sendResponse({ data: target });
    } else {
      sendResponse({ data: null });
    }
  }

  // 3. 抖音定位成功或失效后，清除对应数据
  if (message.type === 'CLEAR_PENDING_COMMENT') {
    const videoId = message.videoId;
    if (videoId && pendingComments[videoId]) {
      delete pendingComments[videoId];
      console.log('[定位助手后台] 已清除定位标记，ID:', videoId);
      sendResponse({ status: 'cleared' });
    }
  }
  return true;
});
