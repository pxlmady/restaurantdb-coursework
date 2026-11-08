import { HttpError } from '../lib/http-error.js';
import { fromPrismaError } from '../lib/prisma-errors.js';

const send = (res, status, code, message, details = []) =>
  res.status(status).json({ error: { code, message, details } });

export const notFoundHandler = (_req, res) => {
  send(res, 404, 'NOT_FOUND', 'Ресурс не знайдено');
};

// Єдиний обробник помилок: Express 5 передає сюди і помилки з async-маршрутів
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  const prismaError = fromPrismaError(err);
  if (prismaError) {
    return send(
      res,
      prismaError.status,
      prismaError.code,
      prismaError.message,
      prismaError.details,
    );
  }

  // Некоректний JSON у тілі запиту (express.json)
  if (err.type === 'entity.parse.failed') {
    return send(res, 400, 'INVALID_JSON', 'Тіло запиту не є коректним JSON');
  }

  console.error(err);
  return send(res, 500, 'INTERNAL_ERROR', 'Внутрішня помилка сервера');
};
