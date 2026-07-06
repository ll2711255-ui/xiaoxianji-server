import axios from 'axios';
import { config } from '../config';

// ---------- 小程序 code2session ----------
interface Code2SessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export async function code2Session(code: string): Promise<Code2SessionResult> {
  const url = 'https://api.weixin.qq.com/sns/jscode2session';
  const { data } = await axios.get(url, {
    params: {
      appid: config.wx.appId,
      secret: config.wx.secret,
      js_code: code,
      grant_type: 'authorization_code',
    },
  });

  if (data.errcode) {
    throw new Error(`wx.login 失败: ${data.errmsg} (errcode=${data.errcode})`);
  }

  return data;
}

// ---------- 小程序订阅消息 ----------
export async function sendSubscribeMessage(
  openid: string,
  templateId: string,
  data: Record<string, { value: string }>,
  page?: string,
): Promise<void> {
  const accessToken = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;

  const body = {
    touser: openid,
    template_id: templateId,
    page: page || '',
    data,
  };

  const { data: result } = await axios.post(url, body);

  if (result.errcode !== 0) {
    console.warn('[wechat] 订阅消息发送失败:', result.errmsg);
  }
}

// ---------- Access Token（内存缓存） ----------
let cachedToken = '';
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const url = 'https://api.weixin.qq.com/cgi-bin/token';
  const { data } = await axios.get(url, {
    params: {
      grant_type: 'client_credential',
      appid: config.wx.appId,
      secret: config.wx.secret,
    },
  });

  if (data.errcode) {
    throw new Error(`获取 access_token 失败: ${data.errmsg}`);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000; // 提前 5 分钟刷新

  return cachedToken;
}
