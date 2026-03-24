import { Request, Response, NextFunction } from 'express';
import { logger_ } from './requestLogger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (err instanceof AppError) {
    logger_.error({
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
    });

    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  logger_.error({
    message: err.message,
    path: req.path,
    stack: err.stack,
  });

  res.status(500).json({
    error: isDevelopment ? err.message : 'Internal Server Error',
    statusCode: 500,
    ...(isDevelopment && { stack: err.stack }),
  });
};
