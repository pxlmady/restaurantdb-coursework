/* =====================================================================
   Етап 5, крок 3. Виправлення структури RestaurantDB_KR (лише ця база).
   1) UQ_Order_Reservation (UNIQUE на стовпці, що допускає NULL) у SQL Server дозволяє
      лише ОДНЕ замовлення без бронювання. Замінюємо його фільтрованим унікальним
      індексом UX_Order_Reservation: одне бронювання — не більше одного замовлення,
      а замовлень без бронювання (NULL) може бути скільки завгодно.
   2) AUTO_CLOSE OFF: база не закривається після останнього підключення
      (у журналі SQL Server зникнуть повідомлення RecoveryUnit::Shutdown).
   Повторний запуск безпечний: кожна зміна виконується, лише якщо ще не зроблена.
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

-- Перед зміною перевіряємо, що дані не порушать нового індексу
IF EXISTS (SELECT id_reservation FROM [Order] WHERE id_reservation IS NOT NULL
           GROUP BY id_reservation HAVING COUNT(*) > 1)
    THROW 50003, N'Є бронювання з кількома замовленнями, індекс створити не можна.', 1;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = N'UQ_Order_Reservation' AND parent_object_id = OBJECT_ID(N'dbo.[Order]'))
BEGIN
    ALTER TABLE dbo.[Order] DROP CONSTRAINT UQ_Order_Reservation;
    PRINT N'Обмеження UQ_Order_Reservation видалено.';
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'UX_Order_Reservation' AND object_id = OBJECT_ID(N'dbo.[Order]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Order_Reservation
        ON dbo.[Order] (id_reservation)
        WHERE id_reservation IS NOT NULL;
    PRINT N'Фільтрований унікальний індекс UX_Order_Reservation створено.';
END
ELSE
    PRINT N'Індекс UX_Order_Reservation уже існує.';

COMMIT;
GO

IF DATABASEPROPERTYEX(N'RestaurantDB_KR', 'IsAutoClose') = 1
BEGIN
    ALTER DATABASE RestaurantDB_KR SET AUTO_CLOSE OFF;
    PRINT N'AUTO_CLOSE вимкнено.';
END
ELSE
    PRINT N'AUTO_CLOSE уже вимкнено.';
GO

-- Результат
SELECT i.name AS index_name, i.is_unique, i.has_filter, i.filter_definition
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID(N'dbo.[Order]') AND i.name IS NOT NULL;
SELECT name, is_auto_close_on FROM sys.databases WHERE name = N'RestaurantDB_KR';
GO
