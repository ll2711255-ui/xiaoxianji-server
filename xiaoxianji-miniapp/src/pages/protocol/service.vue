<template>
  <view class="page">
    <view class="content">
      <text class="title">用户服务协议</text>
      <text class="update-date">最后更新日期：2026年7月13日</text>

      <text class="section-title">一、总则</text>
      <text class="body-text">1.1 欢迎使用小鲜鸡平台（以下简称"本平台"）。在使用本平台服务前，请您仔细阅读本协议的全部内容。</text>
      <text class="body-text">1.2 您通过点击"微信一键登录"按钮或其他方式登录本平台，即表示您已阅读、理解并同意受本协议的约束。</text>
      <text class="body-text">1.3 本平台有权根据需要不时修改本协议，修改后的协议将在本平台公布后生效。</text>

      <text class="section-title">二、服务内容</text>
      <text class="body-text">2.1 本平台为您提供新鲜鸡肉等生鲜产品的在线选购、下单、配送及自取服务。</text>
      <text class="body-text">2.2 本平台有权根据运营需要调整服务内容、商品价格及配送范围，调整前将在平台进行公告。</text>
      <text class="body-text">2.3 部分商品为称重计价，实际支付金额以门店称重结果为准，差价将通过原支付方式退回。</text>

      <text class="section-title">三、用户权利与义务</text>
      <text class="body-text">3.1 您应当提供真实、准确的收货信息（姓名、电话、地址），因信息错误导致的配送延误或失败由您自行承担。</text>
      <text class="body-text">3.2 您应当妥善保管账号信息，不得将账号转让或出借给他人使用。</text>
      <text class="body-text">3.3 您不得利用本平台从事任何违法违规活动，包括但不限于虚假下单、恶意退款、套现等行为。</text>

      <text class="section-title">四、订单与退款</text>
      <text class="body-text">4.1 下单后请在规定时间内完成支付，逾期订单将自动取消。</text>
      <text class="body-text">4.2 称重计价商品的实际支付金额可能与下单时预估金额存在差异，多退少补。</text>
      <text class="body-text">4.3 如对商品品质不满意，可在收到商品后24小时内联系客服申请退款或换货。</text>
      <text class="body-text">4.4 生鲜商品一经出库，除品质问题外不支持无理由退货。</text>

      <text class="section-title">五、免责声明</text>
      <text class="body-text">5.1 因不可抗力（自然灾害、政府行为、网络故障等）导致服务中断的，本平台不承担责任，但将尽力恢复服务。</text>
      <text class="body-text">5.2 因您自身原因（手机没电、无人收货等）导致的损失，本平台不承担责任。</text>

      <text class="section-title">六、联系方式</text>
      <text class="body-text">如对本协议有任何疑问，请联系客服：400-000-0000</text>
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
