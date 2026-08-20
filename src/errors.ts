import { HttpStatus } from './constants/http';
import { ErrorMessage } from './constants/messages';

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message: string = ErrorMessage.AUTHENTICATION_REQUIRED) {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = ErrorMessage.FORBIDDEN) {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ErrorMessage.RESOURCE_NOT_FOUND) {
    super(message, HttpStatus.NOT_FOUND);
  }
}
