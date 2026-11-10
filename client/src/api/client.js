// Звернення до CRUD API сервера (етап 6). Vite перенаправляє /api на http://localhost:3000.
// Помилки сервера мають вигляд { error: { code, message, details: [{ field, message }] } }.

export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const SERVER_DOWN = 'Сервер недоступний. Перевірте, чи запущено npm run dev:server';

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, SERVER_DOWN);
  }
  if (response.status === 204) return null;

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Не JSON: зазвичай це відповідь проксі Vite, коли сервер не запущений
  }
  if (!response.ok) {
    const error = data?.error;
    if (!error && response.status >= 500) throw new ApiError(response.status, SERVER_DOWN);
    throw new ApiError(
      response.status,
      error?.message ?? `Помилка сервера (${response.status})`,
      error?.details ?? [],
    );
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};

// Розподіляє помилку API на помилки полів форми та загальне повідомлення.
// knownFields — поля, які є у формі; решта деталей додається до загального повідомлення.
export function splitApiError(error, knownFields) {
  if (!(error instanceof ApiError)) {
    return { fieldErrors: {}, formError: error?.message ?? 'Невідома помилка' };
  }
  const fieldErrors = {};
  const other = [];
  for (const { field, message } of error.details) {
    if (!message) continue;
    if (knownFields.includes(field) && !fieldErrors[field]) fieldErrors[field] = message;
    else other.push(field ? `${field}: ${message}` : message);
  }
  const formError =
    Object.keys(fieldErrors).length > 0 && other.length === 0
      ? error.message
      : [error.message, ...other].join('. ');
  return { fieldErrors, formError };
}
