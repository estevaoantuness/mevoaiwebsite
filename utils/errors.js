/**
 * Classes de erro personalizadas para a API Mevo
 *
 * Uso:
 *   throw new ApiError(400, 'VALIDATION_ERROR', 'Campo email é obrigatório');
 *   throw new NotFoundError('Propriedade não encontrada');
 *   throw new UnauthorizedError('Token expirado');
 */

// Códigos de erro padronizados
export const ErrorCodes = {
  // Validação (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // Autenticação (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',

  // Autorização (403)
  FORBIDDEN: 'FORBIDDEN',
  ACCESS_DENIED: 'ACCESS_DENIED',

  // Não encontrado (404)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // Conflito (409)
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // Rate limiting (429)
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Erro interno (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
};

/**
 * Classe base para erros da API
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';

    // Captura stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Erro 400 - Bad Request / Validação
 */
export class ValidationError extends ApiError {
  constructor(message = 'Dados inválidos', details = null) {
    super(400, ErrorCodes.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Erro 401 - Não autenticado
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Não autorizado', code = ErrorCodes.UNAUTHORIZED) {
    super(401, code, message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Erro 403 - Acesso negado
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Acesso negado') {
    super(403, ErrorCodes.FORBIDDEN, message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Erro 404 - Não encontrado
 */
export class NotFoundError extends ApiError {
  constructor(resource = 'Recurso', message = null) {
    super(404, ErrorCodes.NOT_FOUND, message || `${resource} não encontrado(a)`);
    this.name = 'NotFoundError';
  }
}

/**
 * Erro 409 - Conflito (registro duplicado, etc)
 */
export class ConflictError extends ApiError {
  constructor(message = 'Conflito de dados') {
    super(409, ErrorCodes.CONFLICT, message);
    this.name = 'ConflictError';
  }
}

/**
 * Erro 429 - Muitas requisições
 */
export class TooManyRequestsError extends ApiError {
  constructor(message = 'Muitas requisições. Tente novamente mais tarde.') {
    super(429, ErrorCodes.TOO_MANY_REQUESTS, message);
    this.name = 'TooManyRequestsError';
  }
}

/**
 * Erro 500 - Erro interno
 */
export class InternalError extends ApiError {
  constructor(message = 'Erro interno do servidor') {
    super(500, ErrorCodes.INTERNAL_ERROR, message);
    this.name = 'InternalError';
  }
}

/**
 * Erro de serviço externo (WhatsApp, Email, etc)
 */
export class ExternalServiceError extends ApiError {
  constructor(service, message = 'Erro no serviço externo') {
    super(502, ErrorCodes.EXTERNAL_SERVICE_ERROR, `${service}: ${message}`);
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

/**
 * Middleware de tratamento de erros para Express
 * Adicione como último middleware
 */
export function errorHandler(err, req, res, next) {
  // Erros conhecidos da API
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Erros de validação do Joi/express-validator
  if (err.isJoi || err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Dados inválidos',
      code: ErrorCodes.VALIDATION_ERROR,
      details: err.details || err.message,
    });
  }

  // Erros do Prisma
  if (err.code?.startsWith('P')) {
    console.error('Prisma Error:', err.code, err.message);

    const prismaErrors = {
      P2002: { status: 409, message: 'Registro duplicado' },
      P2025: { status: 404, message: 'Registro não encontrado' },
      P2003: { status: 400, message: 'Violação de chave estrangeira' },
    };

    const known = prismaErrors[err.code];
    if (known) {
      return res.status(known.status).json({
        error: known.message,
        code: ErrorCodes.DATABASE_ERROR,
      });
    }
  }

  // Erro de CORS
  if (err.message === 'Não permitido por CORS') {
    return res.status(403).json({
      error: 'Origem não permitida',
      code: ErrorCodes.FORBIDDEN,
    });
  }

  // Erro desconhecido - log e resposta genérica
  console.error('Unhandled Error:', err);

  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    error: 'Erro interno do servidor',
    code: ErrorCodes.INTERNAL_ERROR,
    ...(isProduction ? {} : { stack: err.stack, message: err.message }),
  });
}

/**
 * Wrapper para async handlers - captura erros automaticamente
 *
 * Uso:
 *   router.get('/users', asyncHandler(async (req, res) => {
 *     const users = await prisma.user.findMany();
 *     res.json(users);
 *   }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
