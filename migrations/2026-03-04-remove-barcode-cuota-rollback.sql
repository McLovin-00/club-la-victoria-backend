-- Rollback: restaurar columna barcode en cuota
-- Fecha: 2026-03-04

ALTER TABLE cuota
ADD COLUMN IF NOT EXISTS barcode VARCHAR(50) UNIQUE NULL;

CREATE INDEX IF NOT EXISTS idx_cuota_barcode ON cuota(barcode);
