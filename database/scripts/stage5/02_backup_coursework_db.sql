/* =====================================================================
   Етап 5, крок 2 (і будь-коли перед зміною структури). Повний бекап RestaurantDB_KR.
   Файл створюється всередині контейнера: /var/opt/mssql/backup/RestaurantDB_KR_<дата_час>.bak
   (том Docker restaurantdb-mssql-data, тож він не зникає після перезапуску).
   COPY_ONLY: окремий бекап, який не змінює ланцюжок інших бекапів.
   Скопіювати файл на диск: docker cp restaurantdb-mssql:/var/opt/mssql/backup/<файл> database/backup/
   ===================================================================== */
SET NOCOUNT ON;

IF DB_ID(N'RestaurantDB_KR') IS NULL
    THROW 50001, N'Бази RestaurantDB_KR немає: спершу виконайте 01_create_coursework_db.sql.', 1;

-- Створює папку, якщо її ще немає
EXEC master.sys.xp_create_subdir N'/var/opt/mssql/backup';

DECLARE @file NVARCHAR(260) = N'/var/opt/mssql/backup/RestaurantDB_KR_'
    + FORMAT(SYSDATETIME(), 'yyyyMMdd_HHmmss') + N'.bak';

BACKUP DATABASE RestaurantDB_KR TO DISK = @file
WITH COPY_ONLY, INIT, CHECKSUM, NAME = N'RestaurantDB_KR full backup', STATS = 50;

RESTORE VERIFYONLY FROM DISK = @file WITH CHECKSUM;

PRINT N'Бекап записано: ' + @file;
GO
