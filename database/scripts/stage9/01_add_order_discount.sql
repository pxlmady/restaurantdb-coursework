/* =====================================================================
   Етап 9, крок 1. Знижка замовлення: стовпець [Order].discount_percent (лише RestaurantDB_KR).
   Перед запуском зробіть бекап: stage5/02_backup_coursework_db.sql.

   Сума замовлення в базі не зберігається (рахується за цінами страв), тому зберігаємо
   лише ВІДСОТОК знижки. Його визначає сервер за правилами знижок і фіксує в замовленні,
   тож зміна правил пізніше не змінює вже оплачених замовлень.
     discount_percent DECIMAL(5,2) NOT NULL
       DEFAULT 0  (DF_Order_Discount)  — наявні замовлення отримують 0 %, тобто без знижки;
       CHECK 0..100 (CHK_Order_Discount).
   Наявні дані не змінюються: додається лише новий стовпець зі значенням 0.
   Повторний запуск безпечний: кожна зміна виконується, лише якщо ще не зроблена.
   ===================================================================== */
USE RestaurantDB_KR;
GO
-- Фільтрований індекс UX_Order_Reservation вимагає цих параметрів під час зміни [Order]
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'RestaurantDB_KR'
    THROW 50002, N'Скрипт призначений лише для бази RestaurantDB_KR.', 1;

BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.[Order]', N'discount_percent') IS NULL
BEGIN
    -- NOT NULL разом з DEFAULT: SQL Server одразу записує 0 в усі наявні рядки
    ALTER TABLE dbo.[Order]
        ADD discount_percent DECIMAL(5, 2) NOT NULL
            CONSTRAINT DF_Order_Discount DEFAULT 0;
    PRINT N'Стовпець discount_percent додано (наявні замовлення: 0 %).';
END
ELSE
    PRINT N'Стовпець discount_percent уже існує.';

COMMIT;
GO

-- CHECK в окремому пакеті: у тому самому пакеті, де стовпець додано, SQL Server його ще «не бачить»
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CHK_Order_Discount' AND parent_object_id = OBJECT_ID(N'dbo.[Order]'))
BEGIN
    ALTER TABLE dbo.[Order] WITH CHECK
        ADD CONSTRAINT CHK_Order_Discount CHECK (discount_percent >= 0 AND discount_percent <= 100);
    PRINT N'Обмеження CHK_Order_Discount створено.';
END
ELSE
    PRINT N'Обмеження CHK_Order_Discount уже існує.';
GO

-- Результат
SELECT c.name AS column_name, t.name AS type_name, c.precision, c.scale, c.is_nullable,
       dc.name AS default_name, dc.definition AS default_value
FROM sys.columns AS c
JOIN sys.types AS t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints AS dc ON dc.object_id = c.default_object_id
WHERE c.object_id = OBJECT_ID(N'dbo.[Order]') AND c.name = N'discount_percent';

SELECT name, definition FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID(N'dbo.[Order]') AND name = N'CHK_Order_Discount';

SELECT COUNT(*) AS orders_total, SUM(CASE WHEN discount_percent = 0 THEN 1 ELSE 0 END) AS without_discount
FROM dbo.[Order];
GO
