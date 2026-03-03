-- Migración: Actualizar formato de barcode
-- Fecha: 2026-02-28
-- Descripción: Cambia el formato de barcode de {mes}-{idSocio} a {mes}-{año}-{idSocio}
-- 
-- INSTRUCCIONES:
-- 1. Ejecutar este script DESPUÉS de deployar el nuevo código
-- 2. El script es idempotente: se puede ejecutar múltiples veces sin efectos secundarios
-- 3. Solo actualiza los barcodes que tienen el formato antiguo (sin año)

-- =====================================================
-- BACKUP PREVIO (opcional pero recomendado)
-- =====================================================
-- Crear tabla de backup antes de modificar
-- Descomentar las siguientes líneas si deseas crear un backup:
-- CREATE TABLE cuota_barcode_backup AS
-- SELECT id_cuota, id_socio, periodo, barcode, created_at
-- FROM cuota
-- WHERE barcode IS NOT NULL;

-- =====================================================
-- ACTUALIZAR FORMATO DE BARCODE
-- =====================================================
-- Formato antiguo: {mes}-{idSocio} (ej: 01-123)
-- Formato nuevo: {mes}-{año}-{idSocio} (ej: 01-2026-123)

UPDATE cuota
SET barcode = CONCAT(
    SUBSTRING(periodo, 6, 2), '-',  -- mes (extraído del periodo YYYY-MM)
    SUBSTRING(periodo, 1, 4), '-',  -- año (extraído del periodo YYYY-MM)
    CAST(id_socio AS VARCHAR)       -- idSocio
)
WHERE barcode IS NOT NULL
  -- Solo actualizar los que tienen el formato antiguo (un solo guión)
  AND barcode NOT LIKE '%-%-%';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que no quedan barcodes con formato antiguo
-- Debería retornar 0 filas
-- SELECT barcode FROM cuota 
-- WHERE barcode IS NOT NULL 
-- AND barcode NOT LIKE '%-%-%';

-- Verificar algunos ejemplos del nuevo formato
-- SELECT id_cuota, id_socio, periodo, barcode 
-- FROM cuota 
-- WHERE barcode IS NOT NULL 
-- LIMIT 10;
