const router = require('express').Router()
const https = require('https')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const config = require('../config')
const Merchant = require('../models/Merchant')
const User = require('../models/User')
const { signAccessToken, signRefreshToken, verifyToken } = require('../middleware/auth')
const { getEffectiveWechatConfig } = require('../services/paymentConfig')
const { success, fail } = require('../utils/response')

// 商家登录
router.post('/merchant-login', async (req, res) => {
  try {
    const { username, password, phone } = req.body
    const identifier = username || phone
    if (!identifier || !password) {
      return res.json(fail('请输入账号和密码'))
    }

    const merchant = await Merchant.findOne({
      $or: [{ username: identifier }, { phone: identifier }]
    })
    if (!merchant) {
      return res.json(fail('账号或密码错误'))
    }

    const valid = await bcrypt.compare(password, merchant.password)
    if (!valid) {
      return res.json(fail('账号或密码错误'))
    }

    const payload = { merchantId: merchant._id.toString(), role: merchant.role, type: 'merchant' }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    res.json(success({
      accessToken,
      refreshToken,
      merchantId: merchant._id.toString(),
      role: merchant.role,
      name: merchant.name
    }))
  } catch (err) {
    console.error('登录失败:', err)
    res.status(500).json(fail('登录失败'))
  }
})

// 刷新 token
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(401).json(fail('缺少 refresh_token'))
    }

    const decoded = jwt.verify(refreshToken, config.jwt.secret)
    const payload = {
      merchantId: decoded.merchantId,
      userId: decoded.userId,
      role: decoded.role,
      type: decoded.type
    }

    const newAccessToken = signAccessToken(payload)
    const newRefreshToken = signRefreshToken(payload)

    res.json(success({ accessToken: newAccessToken, refreshToken: newRefreshToken }))
  } catch (err) {
    res.status(401).json(fail('Token 已过期，请重新登录'))
  }
})

// 微信登录（通过 code2Session 获取真实 openid）
router.post('/wx-login', async (req, res) => {
  try {
    const { code, nickname, avatarUrl } = req.body
    if (!code) {
      return res.json(fail('缺少登录凭证'))
    }

    // 调微信 code2Session 获取真实 openid
    // 优先 .env，否则从 DB 支付设置读取（与支付凭证共用同一套回退逻辑）
    const wechatCfg = await getEffectiveWechatConfig()
    const wxAppId = config.wechat.appId || (wechatCfg && wechatCfg.appId) || ''
    const wxAppSecret = config.wechat.appSecret || (wechatCfg && wechatCfg.appSecret) || ''
    if (!wxAppId || !wxAppSecret) {
      console.error('[wx-login] AppID/AppSecret 未配置（.env 和 DB 均无）')
      return res.status(500).json(fail('小程序未配置，请联系管理员'))
    }

    let openid, unionid
    try {
      const code2SessionUrl =
        'https://api.weixin.qq.com/sns/jscode2session' +
        '?appid=' + encodeURIComponent(wxAppId) +
        '&secret=' + encodeURIComponent(wxAppSecret) +
        '&js_code=' + encodeURIComponent(code) +
        '&grant_type=authorization_code'

      const code2SessionRes = await new Promise((resolve, reject) => {
        https.get(code2SessionUrl, (res) => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            try { resolve(JSON.parse(data)) }
            catch (_) { reject(new Error('code2Session 响应解析失败')) }
          })
        }).on('error', reject)
      })

      if (code2SessionRes.errcode) {
        console.error('[wx-login] code2Session 失败:', code2SessionRes)
        return res.json(fail('登录失败，请重试（' + (code2SessionRes.errmsg || '未知错误') + '）'))
      }

      openid = code2SessionRes.openid
      unionid = code2SessionRes.unionid || ''
      console.log('[wx-login] code2Session 成功, openid:', openid)
    } catch (err) {
      console.error('[wx-login] code2Session 网络错误:', err)
      return res.status(500).json(fail('微信服务暂不可用，请稍后重试'))
    }

    let user = await User.findOne({ openid })
    if (!user) {
      user = new User({ openid, unionid, nickname: nickname || '微信用户', avatarUrl: avatarUrl || '' })
      await user.save()
    } else {
      if (nickname) user.nickname = nickname
      if (avatarUrl) user.avatarUrl = avatarUrl
      await user.save()
    }

    const payload = { userId: user._id.toString(), openid, role: 'user', type: 'user' }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    res.json(success({
      openid,
      accessToken,
      refreshToken,
      userId: user._id.toString(),
      phone: user.phone || null,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl
    }))
  } catch (err) {
    console.error('微信登录失败:', err)
    res.status(500).json(fail('登录失败'))
  }
})

// 微信手机号
router.post('/wx-phone', verifyToken, async (req, res) => {
  try {
    const { code, phoneCode } = req.body
    // TODO: 调微信 getPhoneNumber 接口
    // 开发阶段直接存储
    const phone = code || phoneCode || ''
    if (req.user && req.user.userId) {
      await User.findByIdAndUpdate(req.user.userId, { phone })
    }
    res.json(success({ phone }))
  } catch (err) {
    res.status(500).json(fail('获取手机号失败'))
  }
})

module.exports = router
