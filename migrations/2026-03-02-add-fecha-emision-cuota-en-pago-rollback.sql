-- Rollback: eliminar fecha/hora de emision de cuota en registro de pagos
-- Fecha: 2026-03-02

DROP INDEX IF EXISTS idx_pago_fecha_emision_cuota;

ALTER TABLE pago_cuota
DROP COLUMN IF EXISTS fecha_emision_cuota;
