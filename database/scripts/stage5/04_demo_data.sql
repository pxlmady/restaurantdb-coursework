/* =====================================================================
   Етап 5, крок 4. Демо-дані для показу CRUD і запитів курсової у RestaurantDB_KR.
   Лише ДОДАЄ рядки (INSERT): структуру не змінює, наявні записи не змінює й не видаляє.
   Усе виконується в одній транзакції. Повторний запуск нічого не додає:
   якщо демо-дані вже є (відвідувач з телефоном +380930000101), скрипт завершується.
   Потрібен попередній крок 03: серед замовлень є кілька без бронювання.
   ===================================================================== */
USE RestaurantDB_KR;
GO
-- Фільтрований індекс вимагає цих параметрів сеансу і під час створення, і під час
-- кожної зміни даних таблиці. SSMS, PyCharm, JDBC і Prisma вмикають їх самі, sqlcmd — ні.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'RestaurantDB_KR'
    THROW 50002, N'Скрипт призначений лише для бази RestaurantDB_KR.', 1;

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_Order_Reservation')
    THROW 50004, N'Спершу виконайте 03_fix_structure.sql: демо-дані містять кілька замовлень без бронювання.', 1;

IF EXISTS (SELECT 1 FROM Visitor WHERE phone_number = '+380930000101')
BEGIN
    PRINT N'Демо-дані вже додано, повторно нічого не вставляється.';
    RETURN;
END;

BEGIN TRANSACTION;

-- Відвідувачі. Бондаренко і Ткачук без бронювань (для запиту Q4)
INSERT INTO Visitor (full_name, phone_number) VALUES
    (N'Петренко Ольга',    '+380930000101'),
    (N'Коваленко Максим',  '+380930000102'),
    (N'Шевченко Анна',     '+380930000103'),
    (N'Мороз Дмитро',      '+380930000104'),
    (N'Лисенко Ірина',     '+380930000105'),
    (N'Кравчук Богдан',    '+380930000106'),
    (N'Бондаренко Юлія',   '+380930000107'),
    (N'Ткачук Сергій',     '+380930000108');

-- Столики різної місткості (наявні: 1 і 2 на 4 особи)
INSERT INTO [Table] (table_number, capacity) VALUES
    (3, 2), (4, 2), (5, 6), (6, 6), (7, 8), (8, 10);

-- Офіціанти. Савчук Оксана без замовлень (нулі в запиті Q7)
INSERT INTO Waiter (full_name) VALUES
    (N'Коваль Наталія'), (N'Гнатюк Тарас'), (N'Савчук Оксана');

-- Страви. Пампушки і Качка з яблуками ніхто не замовляє (запит Q4)
INSERT INTO Dish (title, price, weight_grams) VALUES
    (N'Вареники з вишнею',    150.00, 300),
    (N'Деруни зі сметаною',   135.00, 280),
    (N'Котлета по-київськи',  230.00, 250),
    (N'Голубці',              180.00, 350),
    (N'Салат Олів''є',        120.00, 250),
    (N'Банош з бринзою',      210.00, 300),
    (N'Узвар',                 45.00, 300),
    (N'Компот',                40.00, 300),
    (N'Пампушки з часником',   35.00, 120),
    (N'Качка з яблуками',     420.00, 450);

-- Бронювання: відвідувача шукаємо за телефоном, id не захардкоджені.
-- Завершені — у минулому (до них є замовлення), активні — після 07.11.2026 (запит Q8).
INSERT INTO Reservation (id_visitor, table_number, date_time, people_count, reservation_status)
SELECT v.id_visitor, r.tbl, r.dt, r.ppl, r.st
FROM (VALUES
    ('+380671112233', 2, CAST('2026-10-03 19:00' AS DATETIME), 3, N'Завершене'),
    ('+380930000101', 3, CAST('2026-10-05 13:00' AS DATETIME), 2, N'Завершене'),
    ('+380930000102', 5, CAST('2026-10-10 18:30' AS DATETIME), 5, N'Завершене'),
    ('+380930000103', 7, CAST('2026-10-12 20:00' AS DATETIME), 8, N'Завершене'),
    ('+380930000101', 1, CAST('2026-10-18 19:30' AS DATETIME), 4, N'Завершене'),
    ('+380930000104', 4, CAST('2026-10-20 12:00' AS DATETIME), 2, N'Скасоване'),
    ('+380930000105', 6, CAST('2026-10-24 18:00' AS DATETIME), 6, N'Завершене'),
    ('+380930000106', 8, CAST('2026-10-31 19:00' AS DATETIME), 10, N'Завершене'),
    ('+380930000102', 2, CAST('2026-11-02 14:00' AS DATETIME), 3, N'Завершене'),
    ('+380930000103', 3, CAST('2026-11-05 20:00' AS DATETIME), 2, N'Скасоване'),
    ('+380930000104', 5, CAST('2026-11-08 19:00' AS DATETIME), 4, N'Активне'),
    ('+380930000105', 1, CAST('2026-11-08 19:00' AS DATETIME), 3, N'Активне'),
    ('+380930000106', 7, CAST('2026-11-12 18:00' AS DATETIME), 7, N'Активне'),
    ('+380930000101', 4, CAST('2026-11-14 13:00' AS DATETIME), 2, N'Активне')
) r(phone, tbl, dt, ppl, st)
JOIN Visitor v ON v.phone_number = r.phone;

-- Замовлення. k — тимчасовий ключ рядка лише для зв'язку з позиціями нижче.
-- Замовлення з phone = NULL зроблені без бронювання (гості без запису).
CREATE TABLE #ord (
    k INT PRIMARY KEY, phone VARCHAR(20) NULL, dt DATETIME NULL, tbl INT NOT NULL,
    waiter NVARCHAR(100) NOT NULL, st NVARCHAR(20) NOT NULL, tips DECIMAL(10,2) NOT NULL);
INSERT INTO #ord VALUES
    ( 1, '+380671112233', '2026-10-03 19:00', 2, N'Мельник Олексій', N'Оплачено',      60.00),
    ( 2, '+380930000101', '2026-10-05 13:00', 3, N'Коваль Наталія',  N'Оплачено',      30.00),
    ( 3, '+380930000102', '2026-10-10 18:30', 5, N'Гнатюк Тарас',    N'Оплачено',     150.00),
    ( 4, '+380930000103', '2026-10-12 20:00', 7, N'Коваль Наталія',  N'Оплачено',     300.00),
    ( 5, '+380930000101', '2026-10-18 19:30', 1, N'Мельник Олексій', N'Оплачено',      80.00),
    ( 6, '+380930000105', '2026-10-24 18:00', 6, N'Гнатюк Тарас',    N'Оплачено',     120.00),
    ( 7, '+380930000106', '2026-10-31 19:00', 8, N'Коваль Наталія',  N'Оплачено',     400.00),
    ( 8, '+380930000102', '2026-11-02 14:00', 2, N'Мельник Олексій', N'Скасовано',      0.00),
    ( 9, NULL,            NULL,               4, N'Гнатюк Тарас',    N'Оплачено',      25.00),
    (10, NULL,            NULL,               6, N'Коваль Наталія',  N'Оплачено',      70.00),
    (11, NULL,            NULL,               3, N'Мельник Олексій', N'В очікуванні',   0.00);

CREATE TABLE #map (k INT PRIMARY KEY, id_order INT NOT NULL);

-- MERGE з умовою 1 = 0 лише вставляє, але, на відміну від INSERT, дає в OUTPUT
-- і тимчасовий ключ k, і новий id_order
MERGE INTO [Order] AS t
USING (
    SELECT o.k, res.id_reservation, w.id_waiter, o.st, o.tbl, o.tips
    FROM #ord o
    JOIN Waiter w ON w.full_name = o.waiter
    LEFT JOIN Visitor v ON v.phone_number = o.phone
    LEFT JOIN Reservation res ON res.id_visitor = v.id_visitor AND res.date_time = o.dt
) AS s ON 1 = 0
WHEN NOT MATCHED THEN
    INSERT (id_reservation, id_waiter, payment_status, table_number, tips)
    VALUES (s.id_reservation, s.id_waiter, s.st, s.tbl, s.tips)
OUTPUT s.k, inserted.id_order INTO #map (k, id_order);

IF (SELECT COUNT(*) FROM #map) <> (SELECT COUNT(*) FROM #ord)
    THROW 50005, N'Не всі демо-замовлення знайшли офіціанта або бронювання.', 1;

-- Позиції замовлень
INSERT INTO OrderDetail (id_order, id_dish, quantity)
SELECT m.id_order, d.id_dish, i.qty
FROM (VALUES
    ( 1, N'Борщ', 3), ( 1, N'Голубці', 2), ( 1, N'Узвар', 3),
    ( 2, N'Вареники з вишнею', 2), ( 2, N'Компот', 2),
    ( 3, N'Борщ', 5), ( 3, N'Котлета по-київськи', 5), ( 3, N'Узвар', 5),
    ( 4, N'Банош з бринзою', 4), ( 4, N'Деруни зі сметаною', 8), ( 4, N'Салат Олів''є', 4), ( 4, N'Компот', 8),
    ( 5, N'Котлета по-київськи', 2), ( 5, N'Салат Олів''є', 2), ( 5, N'Узвар', 4),
    ( 6, N'Вареники з вишнею', 6), ( 6, N'Голубці', 3), ( 6, N'Компот', 6),
    ( 7, N'Борщ', 10), ( 7, N'Банош з бринзою', 6), ( 7, N'Котлета по-київськи', 4), ( 7, N'Узвар', 10),
    ( 8, N'Деруни зі сметаною', 3),
    ( 9, N'Деруни зі сметаною', 1), ( 9, N'Узвар', 1),
    (10, N'Голубці', 2), (10, N'Борщ', 2), (10, N'Компот', 2),
    (11, N'Вареники з вишнею', 1), (11, N'Узвар', 1)
) i(k, dish, qty)
JOIN #map m ON m.k = i.k
JOIN Dish d ON d.title = i.dish;

IF @@ROWCOUNT <> 30
    THROW 50006, N'Не всі позиції замовлень знайшли страву.', 1;

COMMIT;
PRINT N'Демо-дані додано.';
GO

SELECT 'Visitor' AS tbl, COUNT(*) AS rows FROM Visitor UNION ALL
SELECT '[Table]', COUNT(*) FROM [Table] UNION ALL
SELECT 'Waiter', COUNT(*) FROM Waiter UNION ALL
SELECT 'Dish', COUNT(*) FROM Dish UNION ALL
SELECT 'Reservation', COUNT(*) FROM Reservation UNION ALL
SELECT '[Order]', COUNT(*) FROM [Order] UNION ALL
SELECT 'OrderDetail', COUNT(*) FROM OrderDetail;
GO
