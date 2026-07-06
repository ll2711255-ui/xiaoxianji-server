/**
 * PrismaClient 单例
 *
 * 全局共享一个数据库连接实例，避免各路由文件独立创建导致连接池耗尽。
 *
 * 使用方式：
 *   const prisma = require('../db');
 *   const user = await prisma.user.findUnique({ where: { id: 1 } });
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
