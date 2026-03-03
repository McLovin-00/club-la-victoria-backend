-- Migración: Rollback del formato de barcode
-- Fecha: 2026-02-28
-- Descripción: Revierte el formato de barcode de {mes}-{año}-{idSocio} a {mes}-{idSocio}
-- 
-- ADVERTENCIA: Esta migración revierte los barcodes al formato antiguo.
-- Usar solo si es necesario volver a la versión anterior del código.

-- =====================================================
-- REVERTIR FORMATO DE BARCODE
-- =====================================================
-- Formato nuevo: {mes}-{año}-{idSocio} (ej: 01-2026-123)
-- Formato antiguo: {mes}-{idSocio} (ej: 01-123)

UPDATE cuota
SET barcode = CONCAT(
    SUBSTRING(periodo, 6, 2), '-',  -- mes (extraído del periodo YYYY-MM)
    CAST(id_socio AS VARCHAR)       -- idSocio
)
WHERE barcode IS NOT NULL
  -- Solo revertir los que tienen el formato nuevo (dos guiones)
  AND barcode LIKE '%-%-%';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que no quedan barcodes con formato nuevo
-- Debería retornar 0 filas
-- SELECT barcode FROM cuota 
-- WHERE barcode IS NOT NULL 
-- AND barcode LIKE '%-%-%';

-- Verificar algunos ejemplos del formato antiguo
-- SELECT id_cuota, id_socio, periodo, barcode 
-- FROM cuota 
-- WHERE barcode IS NOT NULL 
-- LIMIT 10;

-- =====================================================
-- ELIMINAR BACKUP (si se creó)
-- =====================================================
-- Descomentar si creaste la tabla de backup y ya no la necesitas:
-- DROP TABLE IF EXISTS cuota_barcode_backup;
