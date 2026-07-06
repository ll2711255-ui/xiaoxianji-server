import { Response } from 'express';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

export function success<T>(res: Response, data?: T, message = 'ok'): void {
  res.json({ code: 0, message, data });
}

export function fail(res: Response, message: string, code = 1, statusCode = 200): void {
  res.status(statusCode).json({ code, message });
}

export function created<T>(res: Response, data?: T, message = '创建成功'): void {
  res.status(201).json({ code: 0, message, data });
}
