<template>
  <view class="page">
    <view class="content">
      <text class="title">隐私政策</text>
      <text class="update-date">最后更新日期：2026年7月13日</text>

      <text class="section-title">一、信息收集</text>
      <text class="body-text">1.1 当您使用微信快捷登录时，本平台仅获取您的微信OpenID用于识别用户身份，不会获取您的微信头像、昵称、性别等个人资料。</text>
      <text class="body-text">1.2 当您下单时，我们需要收集您的收货人姓名、手机号码和收货地址，以便完成商品配送。</text>
      <text class="body-text">1.3 当您使用微信支付时，支付过程由微信支付直接处理，本平台不会存储您的银行卡号、支付密码等敏感信息。</text>

      <text class="section-title">二、信息使用</text>
      <text class="body-text">2.1 我们收集您的信息仅用于以下目的：</text>
      <text class="body-text">• 创建和管理您的用户账户</text>
      <text class="body-text">• 处理您的订单并完成配送</text>
      <text class="body-text">• 向您推送订单状态更新</text>
      <text class="body-text">• 提供客户服务与售后支持</text>
      <text class="body-text">2.2 未经您明确授权，我们不会将您的个人信息用于上述目的之外的任何用途。</text>

      <text class="section-title">三、信息存储与保护</text>
      <text class="body-text">3.1 您的个人信息存储于腾讯云服务器，采用业界标准的加密传输（HTTPS）和安全存储措施。</text>
      <text class="body-text">3.2 我们采取访问控制、数据加密、定期安全审计等措施保护您的信息安全。</text>
      <text class="body-text">3.3 在发生数据安全事件时，我们将按照法律法规要求及时告知您相关情况。</text>

      <text class="section-title">四、信息共享</text>
      <text class="body-text">4.1 我们不会将您的个人信息出售或分享给任何第三方，除非：</text>
      <text class="body-text">• 获得您的明确同意</text>
      <text class="body-text">• 法律法规要求或政府部门依法要求</text>
      <text class="body-text">• 为完成配送服务，向配送人员提供必要的联系方式</text>

      <text class="section-title">五、您的权利</text>
      <text class="body-text">5.1 您可以在"我的"页面查看和编辑您的头像、昵称。</text>
      <text class="body-text">5.2 您可以在"收货地址"页面管理您的收货信息。</text>
      <text class="body-text">5.3 您可以通过退出登录来终止本平台对您信息的进一步使用。</text>
      <text class="body-text">5.4 如需删除账户及全部数据，请联系客服处理。</text>

      <text class="section-title">六、未成年人保护</text>
      <text class="body-text">6.1 本平台主要面向成年人提供服务。如您是未成年人，请在监护人指导下使用本平台。</text>

      <text class="section-title">七、联系方式</text>
      <text class="body-text">如对本隐私政策有任何疑问，请联系客服：400-000-0000</text>
    </view>
  </view>
</template>

<script setup>
// 纯展示页面，无需逻辑
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding: 32rpx;
}

.content {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: 40rpx 32rpx;
}

.title {
  display: block;
  font-size: var(--font-2xl);
  font-weight: var(--weight-bold);
  color: var(--color-text-1);
  text-align: center;
  margin-bottom: 12rpx;
}

.update-date {
  display: block;
  font-size: var(--font-sm);
  color: var(--color-text-3);
  text-align: center;
  margin-bottom: 40rpx;
}

.section-title {
  display: block;
  font-size: var(--font-lg);
  font-weight: var(--weight-bold);
  color: var(--color-text-1);
  margin-top: 32rpx;
  margin-bottom: 16rpx;
}

.body-text {
  display: block;
  font-size: var(--font-md);
  color: var(--color-text-2);
  line-height: 1.8;
  margin-bottom: 12rpx;
}
</style>
