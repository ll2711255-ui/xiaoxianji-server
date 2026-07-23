/**
 * 商品与分类服务
 */
const db = require('../config/db');

// ========== 商品 ==========

async function getProducts({ categoryId, keyword, page = 1, pageSize = 20, status } = {}) {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (categoryId) {
    sql += ' AND category_id = ?';
    params.push(categoryId);
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR selling_point LIKE ? OR description LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  } else if (!status) {
    // 未传 status 参数时默认只返回上架商品（公开接口）
    sql += " AND status = 'on'";
  }
  // status === 'all' 时不加筛选条件，返回全部

  const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
  sql += ' ORDER BY sort ASC, create_time DESC';
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize, 10), Math.max(0, offset));

  const rows = await db.query(sql, params);

  // 为每个商品计算最低价（分），方便前端列表展示
  return rows.map(r => {
    let minPrice = 0;
    if (r.pricing_type === 'exact_weight') {
      // 按斤计价：最低价 = 最小重量 × 单价
      const weights = parseJsonField(r.weight_options);
      const minWeight = (weights && weights.length) ? Math.min(...weights) : 500;
      minPrice = Math.round((r.price_per_jin || 0) * minWeight / 500);
    } else if (r.pricing_type === 'per_piece') {
      minPrice = r.unit_price || 0;
    } else if (r.pricing_type === 'range_weight') {
      // 整鸡规格：取所有规格中最低的单价
      const specs = parseJsonField(r.specs) || [];
      const prices = specs.map(s => s.price_per_jin || 0).filter(p => p > 0);
      minPrice = prices.length ? Math.min(...prices) : 0;
    }
    return { ...r, minPrice };
  });
}

function parseJsonField(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
}

async function getProductById(id) {
  const row = await db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
  if (!row) return null;
  // 计算最低价
  let minPrice = 0;
  if (row.pricing_type === 'exact_weight') {
    const weights = parseJsonField(row.weight_options);
    const minWeight = (weights && weights.length) ? Math.min(...weights) : 500;
    minPrice = Math.round((row.price_per_jin || 0) * minWeight / 500);
  } else if (row.pricing_type === 'per_piece') {
    minPrice = row.unit_price || 0;
  } else if (row.pricing_type === 'range_weight') {
    const specs = parseJsonField(row.specs) || [];
    const prices = specs.map(s => s.price_per_jin || 0).filter(p => p > 0);
    minPrice = prices.length ? Math.min(...prices) : 0;
  }
  return { ...row, minPrice };
}

async function createProduct(data) {
  const sql = `INSERT INTO products
    (name, category_id, pricing_type, selling_point, description, images,
     delivery_modes, processing_options, price_per_jin, weight_options,
     processing_fee, unit_price, specs, emoji, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    data.name, data.categoryId, data.pricingType,
    data.sellingPoint || '', data.description || '',
    JSON.stringify(data.images || []),
    JSON.stringify(data.deliveryModes || ['pickup']),
    JSON.stringify(data.processingOptions || ['整只']),
    data.pricePerJin || 0,
    JSON.stringify(data.weightOptions || [500]),
    data.processingFee || 0,
    data.unitPrice || 0,
    JSON.stringify(data.specs || []),
    data.emoji || '🐔',
    data.sort || 0,
  ];

  return db.insert(sql, params);
}

async function updateProduct(id, data) {
  const fields = [];
  const params = [];

  const map = {
    name: 'name', categoryId: 'category_id', pricingType: 'pricing_type',
    sellingPoint: 'selling_point', description: 'description',
    pricePerJin: 'price_per_jin', processingFee: 'processing_fee',
    unitPrice: 'unit_price', emoji: 'emoji', sort: 'sort',
  };

  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = ?`);
      params.push(data[key]);
    }
  }

  // JSON 字段
  if (data.images !== undefined) { fields.push('images = ?'); params.push(JSON.stringify(data.images)); }
  if (data.deliveryModes !== undefined) { fields.push('delivery_modes = ?'); params.push(JSON.stringify(data.deliveryModes)); }
  if (data.processingOptions !== undefined) { fields.push('processing_options = ?'); params.push(JSON.stringify(data.processingOptions)); }
  if (data.weightOptions !== undefined) { fields.push('weight_options = ?'); params.push(JSON.stringify(data.weightOptions)); }
  if (data.specs !== undefined) { fields.push('specs = ?'); params.push(JSON.stringify(data.specs)); }

  if (fields.length === 0) return 0;

  params.push(id);
  return db.execute(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
}

async function deleteProduct(id) {
  return db.execute('DELETE FROM products WHERE id = ?', [id]);
}

async function updateProductStatus(id, { status, outOfStock } = {}) {
  const fields = [];
  const params = [];
  if (status) { fields.push('status = ?'); params.push(status); }
  if (outOfStock !== undefined) { fields.push('out_of_stock = ?'); params.push(outOfStock ? 1 : 0); }
  if (fields.length === 0) return 0;
  params.push(id);
  return db.execute(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
}

// ========== 分类 ==========

async function getCategories() {
  return db.query('SELECT * FROM categories ORDER BY sort ASC');
}

async function createCategory(name) {
  const maxSort = await db.queryOne('SELECT MAX(sort) as maxSort FROM categories');
  const sort = (maxSort && maxSort.maxSort + 1) || 1;
  return db.insert('INSERT INTO categories (name, sort) VALUES (?, ?)', [name, sort]);
}

async function deleteCategory(id) {
  return db.execute('DELETE FROM categories WHERE id = ?', [id]);
}

async function updateCategorySort(sorts) {
  // sorts: [{ id, sort }] 或 [{ _id, sort }]（前端统一用 _id）
  for (const item of sorts) {
    const id = item._id || item.id;
    if (!id) continue;
    await db.execute('UPDATE categories SET sort = ? WHERE id = ?', [item.sort, id]);
  }
  return sorts.length;
}

module.exports = {
  getProducts, getProductById, createProduct, updateProduct, deleteProduct, updateProductStatus,
  getCategories, createCategory, deleteCategory, updateCategorySort,
};
