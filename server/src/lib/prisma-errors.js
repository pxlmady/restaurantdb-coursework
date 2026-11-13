// Переклад помилок Prisma / SQL Server на зрозумілі повідомлення.
// Обмеження CHECK Prisma повертає з кодом P2003 і текстом про зовнішній ключ,
// тому помилку розпізнаємо за назвою обмеження, а не лише за кодом.
import { Prisma } from '@prisma/client';
import { HttpError } from './http-error.js';

// Порушення UNIQUE (P2002). Для обмежень UQ_ Prisma повертає назву таблиці, для індексів — назву індексу.
const UNIQUE_MESSAGES = {
  Visitor: ['phone_number', 'Відвідувач з таким номером телефону вже існує'],
  Dish: ['title', 'Страва з такою назвою вже є в меню'],
  Table: ['table_number', 'Столик з таким номером уже існує'],
  OrderDetail: ['id_dish', 'Ця страва вже є в замовленні'],
  UX_Order_Reservation: ['id_reservation', 'Для цього бронювання вже створено замовлення'],
};

// CHECK-обмеження (P2003 з назвою CHK_...)
const CHECK_MESSAGES = {
  CHK_Table_Capacity: ['capacity', 'Місткість столика має бути більшою за 0'],
  CHK_Dish_Price: ['price', 'Ціна не може бути від’ємною'],
  CHK_Dish_Weight: ['weight_grams', 'Вага має бути більшою за 0'],
  CHK_Reservation_People: ['people_count', 'Кількість осіб має бути більшою за 0'],
  CHK_Reservation_Status: ['reservation_status', 'Недопустимий статус бронювання'],
  CHK_Order_Status: ['payment_status', 'Недопустимий статус оплати'],
  CHK_Order_Tips: ['tips', 'Чайові не можуть бути від’ємними'],
  CHK_Order_Discount: ['discount_percent', 'Знижка має бути від 0 до 100 %'],
  CHK_OrderDetail_Quantity: ['quantity', 'Кількість має бути більшою за 0'],
};

// Зовнішні ключі (P2003 з назвою FK_...): зв'язок, який порушено
const FK_LINKS = {
  FK_Reservation_Visitor: 'відвідувач → бронювання',
  FK_Reservation_Table: 'столик → бронювання',
  FK_Order_Reservation: 'бронювання → замовлення',
  FK_Order_Waiter: 'офіціант → замовлення',
  FK_Order_Table: 'столик → замовлення',
  FK_OrderDetail_Order: 'замовлення → позиції',
  FK_OrderDetail_Dish: 'страва → позиції замовлення',
};

export const fromPrismaError = (err) => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  const meta = err.meta ?? {};

  switch (err.code) {
    case 'P2002': {
      const [field, message] = UNIQUE_MESSAGES[meta.target] ??
        UNIQUE_MESSAGES[meta.modelName] ?? [null, 'Запис з такими значеннями вже існує'];
      return new HttpError(409, 'UNIQUE_VIOLATION', message, field ? [{ field, message }] : []);
    }
    case 'P2003': {
      const constraint = meta.constraint ?? '';
      if (CHECK_MESSAGES[constraint]) {
        const [field, message] = CHECK_MESSAGES[constraint];
        return new HttpError(400, 'CHECK_VIOLATION', message, [{ field, message, constraint }]);
      }
      const link = FK_LINKS[constraint] ?? constraint;
      return new HttpError(
        409,
        'FOREIGN_KEY_VIOLATION',
        `Операцію відхилено: порушується зв'язок ${link}`,
        [{ constraint }],
      );
    }
    case 'P2025':
      return new HttpError(404, 'NOT_FOUND', 'Запис не знайдено');
    case 'P2000': {
      const field = meta.column_name;
      const message = 'Значення задовге для цього поля';
      return new HttpError(400, 'VALIDATION_ERROR', message, field ? [{ field, message }] : []);
    }
    default:
      return null;
  }
};
