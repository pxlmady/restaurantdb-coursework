/* =====================================================================
   Етап 5, крок 1. Окрема база курсової RestaurantDB_KR.
   Створюється з того самого бекапу database/backup/RestaurantDB.bak, що й RestaurantDB,
   у тому самому контейнері, але з іншими файлами даних.
   База RestaurantDB (нею користуються практичні 3.1 і 3.2) не змінюється.
   Якщо RestaurantDB_KR уже існує, скрипт нічого не робить.
   ===================================================================== */

IF DB_ID(N'RestaurantDB_KR') IS NOT NULL
BEGIN
    PRINT N'База RestaurantDB_KR уже існує, створення пропущено.';
END
ELSE
BEGIN
    -- Логічні імена файлів у бекапі ті самі (RestaurantDB, RestaurantDB_log),
    -- тому MOVE обов'язковий: інакше відновлення перезаписало б файли RestaurantDB
    RESTORE DATABASE RestaurantDB_KR
    FROM DISK = N'/backup/RestaurantDB.bak'
    WITH MOVE N'RestaurantDB'     TO N'/var/opt/mssql/data/RestaurantDB_KR.mdf',
         MOVE N'RestaurantDB_log' TO N'/var/opt/mssql/data/RestaurantDB_KR_log.ldf',
         STATS = 25;

    ALTER AUTHORIZATION ON DATABASE::RestaurantDB_KR TO sa;

    PRINT N'Базу RestaurantDB_KR створено з бекапу.';
END;
GO
