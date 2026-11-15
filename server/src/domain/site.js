// Правила сайту ресторану для відвідувачів (етап 10). Змінюються тут, в одному місці.
import { RESERVATION_HOURS } from '../queries/q8-free-tables.js';

export const SITE_RULES = {
  // Години роботи ресторану
  open_hour: 10,
  close_hour: 22,
  // Бронювання займає столик на 2 години (правило етапу 7), тому останнє починається о 20:00
  last_booking_hour: 22 - RESERVATION_HOURS,
  reservation_hours: RESERVATION_HOURS,
  // Найбільша кількість різних страв і порцій однієї страви в передзамовленні
  max_preorder_lines: 30,
  max_quantity: 20,
};

// Поточний час у тому самому вигляді, в якому дати лежать у базі: DATETIME не має часового
// поясу, а Prisma читає його як UTC (див. lib/format.js). Тому беремо місцеві години й
// хвилини сервера і складаємо з них «UTC»-дату — її можна порівнювати з date_time бронювань.
export const nowAsStored = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()),
  );
};
