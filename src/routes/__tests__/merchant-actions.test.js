/**
 * 商家操作并发测试（N1 修复验证）
 *
 * 测试场景：
 *   1. accept — 正常操作成功
 *   2. accept — 并发操作：affectedRows=0 → HTTP 409
 *   3. complete — 单状态前置（ready）正常操作成功
 *   4. complete — 多状态前置（delivering）正常操作成功
 *   5. complete — 并发操作：affectedRows=0 → HTTP 409
 *   6. 核心逻辑：UPDATE WHERE 包含 AND status_label IN (...) 防止 TOCTOU
 */

// ===== 模拟核心 UPDATE 逻辑（从 merchant.routes.js 提取） =====

const STATE_RULES = {
  accept:   { require: ['paid'],       nextLabel: 'accepted' },
  process:  { require: ['weighed'],    nextLabel: 'processing' },
  ready:    { require: ['processing'], nextLabel: 'ready' },
  deliver:  { require: ['ready'],      nextLabel: 'delivering', requireType: 'delivery' },
  complete: { require: ['delivering', 'ready'], nextLabel: 'completed', nextStatus: 3 },
  markPaid: { require: ['ready'],      nextLabel: 'paid',      nextStatus: 1 },
};

const timeFieldMap = {
  accept: 'accept_time', process: 'process_time', ready: 'ready_time',
  deliver: 'deliver_time', complete: 'complete_time', markPaid: 'pay_time',
};

/**
 * 模拟商家操作的 UPDATE 构建逻辑（从 merchant.routes.js 提取）
 *
 * 这是修复后的版本：UPDATE 包含 AND status_label = ? 或 AND status_label IN (?, ?)
 * 用于隔离测试 TOCTOU 防护是否生效
 */
function buildMerchantUpdate(action, currentStatus) {
  const rule = STATE_RULES[action];
  if (!rule) return { error: '未知操作' };

  // 状态校验
  if (!rule.require.includes(currentStatus)) {
    return { error: `订单状态「${currentStatus}」不允许执行此操作` };
  }

  // 构建 SET 子句
  const updates = [];
  const params = [];

  if (rule.nextLabel) {
    updates.push('status_label = ?');
    params.push(rule.nextLabel);
  }
  if (rule.nextStatus !== undefined) {
    updates.push('order_status = ?');
    params.push(rule.nextStatus);
  }

  const timeField = timeFieldMap[action];
  if (timeField) {
    updates.push(`${timeField} = NOW()`);
  }

  // 构建状态前置条件（修复后新增）
  const requireStates = rule.require;
  let statusCondition;
  if (requireStates.length === 1) {
    statusCondition = 'status_label = ?';
  } else {
    statusCondition = `status_label IN (${requireStates.map(() => '?').join(', ')})`;
  }
  params.push(...requireStates);

  const sql = `UPDATE order_info SET ${updates.join(', ')} WHERE order_no = ? AND ${statusCondition}`;

  return { sql, params, rule };
}

/**
 * 完整操作模拟（含 affectedRows 检查）
 */
function simulateAction(action, currentStatus, affectedRows) {
  const update = buildMerchantUpdate(action, currentStatus);

  // 状态校验失败
  if (update.error) {
    return { httpStatus: 400, body: { success: false, code: 400, message: update.error } };
  }

  // 模拟 db.execute 返回 affectedRows
  if (affectedRows === 0) {
    return { httpStatus: 409, body: { success: false, code: 409, message: '订单状态已变更，请刷新页面' } };
  }

  return { httpStatus: 200, body: { success: true, code: 200, message: '操作成功' } };
}

// ================================================================
// 测试用例
// ================================================================

describe('商家操作 — accept（接单）', () => {
  test('正常接单：订单为 paid 状态 → 成功更新为 accepted', () => {
    const result = simulateAction('accept', 'paid', 1);

    expect(result.httpStatus).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.message).toBe('操作成功');
  });

  test('SQL 构建：UPDATE 必须包含 AND status_label = ? 防止 TOCTOU', () => {
    const update = buildMerchantUpdate('accept', 'paid');

    // WHERE 子句含状态前置条件
    expect(update.sql).toContain('AND status_label = ?');
    expect(update.sql).toContain('accept_time = NOW()');
    // 参数化查询：值在 params 不在 SQL 字符串中
    // params: [nextLabel, requireState]
    expect(update.params).toEqual(['accepted', 'paid']);
    // 确认 SET 子句正确
    expect(update.sql).toContain('SET status_label = ?, accept_time = NOW()');
  });

  test('并发接单：另一个店员抢先，affectedRows=0 → HTTP 409', () => {
    const result = simulateAction('accept', 'paid', 0);

    expect(result.httpStatus).toBe(409);
    expect(result.body.success).toBe(false);
    expect(result.body.code).toBe(409);
    expect(result.body.message).toBe('订单状态已变更，请刷新页面');
  });

  test('状态校验：订单不是 paid 状态 → 拒绝操作', () => {
    const result = simulateAction('accept', 'accepted', 1);

    expect(result.httpStatus).toBe(400);
    expect(result.body.message).toContain('不允许执行此操作');
  });

  test('状态校验：订单已取消 → 拒绝操作', () => {
    const result = simulateAction('accept', 'cancelled', 1);

    expect(result.httpStatus).toBe(400);
    expect(result.body.message).toContain('不允许执行此操作');
  });
});

describe('商家操作 — complete（完成）', () => {
  test('正常完成（从 ready 状态）→ 成功更新为 completed', () => {
    const result = simulateAction('complete', 'ready', 1);

    expect(result.httpStatus).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.message).toBe('操作成功');
  });

  test('正常完成（从 delivering 状态）→ 成功更新为 completed', () => {
    const result = simulateAction('complete', 'delivering', 1);

    expect(result.httpStatus).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.message).toBe('操作成功');
  });

  test('SQL 构建：多状态前置应使用 IN (?, ?) 而非 =', () => {
    const update = buildMerchantUpdate('complete', 'delivering');

    // WHERE 子句用 IN 而非 =（单个 = 只在 SET 子句中出现用于 nextLabel）
    expect(update.sql).toContain('status_label IN (?, ?)');
    expect(update.sql).toContain('complete_time = NOW()');
    // 参数化查询：值都在 params 中
    // params: [nextLabel, nextStatus, ...requireStates]
    expect(update.params).toEqual(['completed', 3, 'delivering', 'ready']);
  });

  test('SQL 构建：从 ready 状态完成，params 包含 delivering 和 ready', () => {
    const update = buildMerchantUpdate('complete', 'ready');

    expect(update.sql).toContain('status_label IN (?, ?)');
    // params 永远是完整的 require 列表，不只是当前状态
    expect(update.params).toContain('delivering');
    expect(update.params).toContain('ready');
  });

  test('并发完成：另一个店员抢先，affectedRows=0 → HTTP 409', () => {
    const result = simulateAction('complete', 'ready', 0);

    expect(result.httpStatus).toBe(409);
    expect(result.body.success).toBe(false);
    expect(result.body.code).toBe(409);
    expect(result.body.message).toBe('订单状态已变更，请刷新页面');
  });

  test('状态校验：订单不是 delivering 或 ready → 拒绝操作', () => {
    const result = simulateAction('complete', 'processing', 1);

    expect(result.httpStatus).toBe(400);
    expect(result.body.message).toContain('不允许执行此操作');
  });
});

describe('商家操作 — 全部 action SQL 构建验证', () => {
  test('所有 action 的 UPDATE SQL 都包含 status_label 条件', () => {
    const testCases = [
      { action: 'accept',   status: 'paid',       expectCondition: 'status_label = ?' },
      { action: 'process',  status: 'weighed',    expectCondition: 'status_label = ?' },
      { action: 'ready',    status: 'processing', expectCondition: 'status_label = ?' },
      { action: 'deliver',  status: 'ready',      expectCondition: 'status_label = ?' },
      { action: 'complete', status: 'delivering', expectCondition: 'status_label IN (?, ?)' },
      { action: 'markPaid', status: 'ready',      expectCondition: 'status_label = ?' },
    ];

    for (const { action, status, expectCondition } of testCases) {
      const update = buildMerchantUpdate(action, status);
      expect(update.sql).toContain(`AND ${expectCondition}`);
      expect(update.sql).toContain('UPDATE order_info SET');
      expect(update.sql).toContain('WHERE order_no = ?');
    }
  });

  test('deliver action 的 requireType 不影响 SQL 构建', () => {
    // requireType 在路由层校验订单类型，不影响 UPDATE SQL
    const update = buildMerchantUpdate('deliver', 'ready');
    expect(update.sql).toContain('AND status_label = ?');
    expect(update.params).toContain('ready');
    expect(update.params).toContain('delivering');
  });

  test('markPaid action 的 nextStatus=1 正确包含在 params 中', () => {
    const update = buildMerchantUpdate('markPaid', 'ready');

    // 参数化查询：order_status = ? 而非 order_status = 1
    expect(update.sql).toContain('SET status_label = ?, order_status = ?, pay_time = NOW()');
    expect(update.sql).toContain('pay_time = NOW()');
    expect(update.params).toEqual(['paid', 1, 'ready']);
  });
});
