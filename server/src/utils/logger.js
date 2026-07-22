/**
 * Winston 日志 — 支付操作单独日志文件，按天切割
 */
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const logDir = path.join(__dirname, '..', '..', 'logs');

// 通用日志格式
const commonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}] ${stack || message}`;
  })
);

// 通用日志（按天切割，保留30天）
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        commonFormat
      ),
    }),
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      format: commonFormat,
    }),
  ],
});

// 支付专用日志（独立文件，永久保留）
const payLogger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: path.join(logDir, 'payment'),
      filename: 'pay-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '365d',
      format: commonFormat,
    }),
  ],
});

module.exports = logger;
module.exports.payLogger = payLogger;
