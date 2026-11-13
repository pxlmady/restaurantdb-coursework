/* =====================================================================
   Етап 9, крок 2 (необов'язковий). Демо-дані для показу знижки «постійний відвідувач».
   Лише ДОДАЄ рядки (INSERT): структуру не змінює, наявні записи не змінює й не видаляє.

   У демо-даних етапу 5 ні в кого немає 3 оплачених замовлень. Скрипт додає Петренко Ользі
   (+380930000101) ще одне минуле бронювання з оплаченим замовленням. Тоді в неї 3 оплачені
   замовлення, і нове замовлення до її активного бронювання на 14.11.2026 13:00 отримає 5 %.
   Додане замовлення має знижку 0 %: на момент того візиту в неї було лише 2 оплачені.

   Потрібен крок 1 (01_add_order_discount.sql). Повторний запуск нічого не дублює.
   ===================================================================== */
USE RestaurantDB_KR;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'RestaurantDB_KR'
    THROW 50002, N'Скрипт призначений лише для бази RestaurantDB_KR.', 1;

IF COL_LENGTH(N'dbo.[Order]', N'discount_percent') IS NULL
    THROW 50007, N'Спершу виконайте stage9/01_add_order_discount.sql.', 1;

DECLARE @visitor INT = (SELECT id_visitor FROM Visitor WHERE phone_number = '+380930000101');
DECLARE @waiter INT = (SELECT TOP (1) id_waiter FROM Waiter WHERE full_name = N'Коваль Наталія');
DECLARE @dt DATETIME = '2026-11-01T13:00:00';

IF @visitor IS NULL OR @waiter IS NULL
    THROW 50008, N'Немає відвідувача +380930000101 або офіціанта Коваль Наталія (демо-дані етапу 5).', 1;

IF EXISTS (SELECT 1 FROM Reservation WHERE id_visitor = @visitor AND date_time = @dt)
BEGIN
    PRINT N'Демо-дані етапу 9 вже додано, повторно нічого не вставляється.';
    RETURN;
END;

BEGIN TRANSACTION;

INSERT INTO Reservation (id_visitor, table_number, date_time, people_count, reservation_status)
VALUES (@visitor, 3, @dt, 2, N'Завершене');
DECLARE @reservation INT = SCOPE_IDENTITY();

INSERT INTO [Order] (id_reservation, id_waiter, payment_status, table_number, tips, discount_percent)
VALUES (@reservation, @waiter, N'Оплачено', 3, 40.00, 0);
DECLARE @order INT = SCOPE_IDENTITY();

INSERT INTO OrderDetail (id_order, id_dish, quantity)
SELECT @order, d.id_dish, i.qty
FROM (VALUES (N'Вареники з вишнею', 2), (N'Узвар', 2)) i(dish, qty)
JOIN Dish d ON d.title = i.dish;
IF @@ROWCOUNT <> 2
    THROW 50006, N'Не всі позиції замовлення знайшли страву.', 1;

COMMIT;
PRINT N'Демо-дані етапу 9 додано: бронювання №' + CAST(@reservation AS NVARCHAR(10))
    + N', замовлення №' + CAST(@order AS NVARCHAR(10)) + N'.';
GO

-- Оплачені замовлення відвідувачів (за бронюваннями): від 3 — знижка «постійний відвідувач»
SELECT v.full_name, v.phone_number, COUNT(o.id_order) AS paid_orders
FROM Visitor AS v
JOIN Reservation AS r ON r.id_visitor = v.id_visitor
JOIN [Order] AS o     ON o.id_reservation = r.id_reservation AND o.payment_status = N'Оплачено'
GROUP BY v.full_name, v.phone_number
ORDER BY paid_orders DESC, v.full_name;
GO
