// Помилка з HTTP-статусом, яку обробник помилок перетворює на JSON
// у форматі { error: { code, message, details } }.
export class HttpError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message) => new HttpError(404, 'NOT_FOUND', message);

export const conflict = (message, details = []) => new HttpError(409, 'CONFLICT', message, details);

// Помилка введення для одного поля
export const invalidField = (field, message) =>
  new HttpError(400, 'VALIDATION_ERROR', 'Перевірте введені дані', [{ field, message }]);
