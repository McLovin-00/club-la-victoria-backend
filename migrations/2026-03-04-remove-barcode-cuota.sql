-- Migracion: eliminar columna barcode en cuota
-- Fecha: 2026-03-04

DROP INDEX IF EXISTS idx_cuota_barcode;

ALTER TABLE cuota
DROP COLUMN IF EXISTS barcode;
