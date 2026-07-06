import mysql from 'mysql2/promise';
import { config } from '../config';

const pool = mysql.createPool(config.db);

export default pool;

/** 执行单条查询 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/** 执行查询并返回第一行 */
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** 执行 INSERT / UPDATE / DELETE */
export async function execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

/** 分页查询辅助 */
export async function queryPage<T = any>(
  sql: string,
  params: any[],
  page: number,
  pageSize: number,
): Promise<{ list: T[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const countSql = `SELECT COUNT(*) as total FROM (${sql}) AS _count`;
  const dataSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;

  const [countResult, list] = await Promise.all([
    queryOne<{ total: number }>(countSql, params),
    query<T>(dataSql, params),
  ]);

  return { list, total: countResult?.total || 0 };
}
