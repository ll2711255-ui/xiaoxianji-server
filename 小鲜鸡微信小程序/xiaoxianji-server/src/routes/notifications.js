const express = require('express');
const router = express.Router();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

router.post('/subscribe', auth(), async (req, res) => {
  try {
    const { orderNo, templateId } = req.body;
    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) return res.failNotFound();

    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    if (!user?.openid || user.openid.startsWith('merchant_')) return res.ok({ skipped: true });

    const tokenRes = await axios.get(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${process.env.WX_APPID}&secret=${process.env.WX_APP_SECRET}`
    );
    const statusText = { pending:'待支付',paid:'已支付',accepted:'已接单',weighed:'已称重',processing:'制作中',ready:'待取货',delivering:'配送中',completed:'已完成',cancelled:'已取消' };

    await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${tokenRes.data.access_token}`,
      { touser: user.openid, template_id: templateId || '', page: `/pages/orders/detail/detail?orderNo=${orderNo}`,
        data: { character_string1:{value:orderNo}, phrase2:{value:statusText[order.status]}, thing3:{value:order.cardNumber||'无'} } }
    );
    res.ok({ sent: true });
  } catch (err) { logger.error('sendSubscribe:', err); res.fail('发送失败'); }
});

module.exports = router;
