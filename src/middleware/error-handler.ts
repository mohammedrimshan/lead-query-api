import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { ZodError } from 'zod';
import { HttpStatus } from '../constants/http';
import { ErrorMessage } from '../constants/messages';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    res.status(HttpStatus.BAD_REQUEST).json({ message, statusCode: HttpStatus.BAD_REQUEST });
    return;
  }

  // Handle Express JSON parser errors
  if (err instanceof SyntaxError && (err as any).type === 'entity.parse.failed') {
    res.status(HttpStatus.BAD_REQUEST).json({ 
      message: ErrorMessage.INVALID_JSON, 
      statusCode: HttpStatus.BAD_REQUEST 
    });
    return;
  }

  console.error('[Unhandled Error]', err);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    message: ErrorMessage.INTERNAL_SERVER_ERROR,
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  });
}
