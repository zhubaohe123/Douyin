import { Router } from 'express';

const router = Router();

/**
 * GET /api/db/tikhub/fetch_video_comments
 * 代理请求到 TikHub API，避免前端直接调用时的 CORS 限制
 * 
 * Query Params:
 *   aweme_id   - 抖音视频作品 ID (必填)
 *   cursor     - 游标偏移量 (默认 0)
 *   count      - 获取数量 (默认 20)
 * 
 * Headers:
 *   Authorization      - Bearer Token (TikHub 授权令牌)
 *   X-TikHub-API-URL   - 自定义 TikHub 基础 API 地址 (可选，默认 https://api.tikhub.dev)
 */
router.get('/api/db/tikhub/fetch_video_comments', async (req, res) => {
  try {
    const { aweme_id, cursor = 0, count = 20 } = req.query;

    if (!aweme_id) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数 aweme_id',
        data: null
      });
    }

    // 提取授权 Token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        code: 401,
        message: '未提供 TikHub Authorization 授权 Token，请在设置中配置',
        data: null
      });
    }

    // 获取 TikHub API 基础 URL（支持用户自定义）
    let baseUrl = req.headers['x-tikhub-api-url'] || 'https://api.tikhub.dev';
    // 规范化 URL 格式
    baseUrl = baseUrl.trim().replace(/\/+$/, '');

    // 拼接完整的 TikHub 请求地址
    const targetUrl = `${baseUrl}/api/v1/douyin/web/fetch_video_comments?aweme_id=${aweme_id}&cursor=${cursor}&count=${count}`;

    console.log(`[TikHub Proxy] 正在请求: ${targetUrl}`);

    // 发起网络请求
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TikHub Proxy] 远程接口返回非 200 状态码: ${response.status}`, errorText);
      return res.status(response.status).json({
        code: response.status,
        message: `TikHub 远程服务响应错误: ${response.statusText}`,
        details: errorText,
        data: null
      });
    }

    const data = await response.json();
    
    // TikHub 返回的格式通常为 { code: 200, message: "...", data: { comments, cursor, has_more } }
    // 我们原样转发或包装返回
    res.json(data);

  } catch (error) {
    console.error('❌ TikHub Proxy 代理请求失败:', error);
    res.status(500).json({
      code: 500,
      message: 'TikHub Proxy 代理内部错误',
      error: error.message
    });
  }
});

export default router;
