// Перетворення значень бази у JSON-відповіді.

// DATETIME у SQL Server не має часового поясу, а Prisma читає його як UTC.
// Тому віддаємо UTC-частини без зсуву, у форматі поля <input type="datetime-local">.
export const formatDateTime = (date) => date.toISOString().slice(0, 16);

// Гроші (DECIMAL(10,2)) віддаємо рядком з двома знаками: "140.00".
// Рядок, а не число, щоб не втратити точність.
export const formatMoney = (decimal) => decimal.toFixed(2);
