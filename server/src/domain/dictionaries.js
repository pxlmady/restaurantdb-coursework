// Допустимі значення статусів. У базі вони задані обмеженнями CHECK,
// які Prisma не переносить у схему, тому бекенд перевіряє їх сам.
export const RESERVATION_STATUSES = ['Активне', 'Скасоване', 'Завершене']; // CHK_Reservation_Status
export const PAYMENT_STATUSES = ['Оплачено', 'В очікуванні', 'Скасовано']; // CHK_Order_Status
