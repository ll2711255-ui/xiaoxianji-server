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
    sql += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  } else {
    sql += " AND status = 'on'";
  }

  const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
  sql += ' ORDER BY sort ASC, create_time DESC';
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize, 10), Math.max(0, offset));

  return db.query(sql, params);
}

async function getProductById(id) {
  return db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
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
  // sorts: [{ id, sort }]
  for (const item of sorts) {
    await db.execute('UPDATE categories SET sort = ? WHERE id = ?', [item.sort, item.id]);
  }
  return sorts.length;
}

module.exports = {
  getProducts, getProductById, createProduct, updateProduct, updateProductStatus,
  getCategories, createCategory, deleteCategory, updateCategorySort,
};
