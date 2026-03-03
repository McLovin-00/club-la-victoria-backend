-- Migracion: agregar fecha/hora de emision de cuota en registro de pagos
-- Fecha: 2026-03-02

ALTER TABLE pago_cuota
ADD COLUMN IF NOT EXISTS fecha_emision_cuota TIMESTAMP NULL;

UPDATE pago_cuota pc
SET fecha_emision_cuota = c.created_at
FROM cuota c
WHERE c.id_cuota = pc.id_cuota
  AND pc.fecha_emision_cuota IS NULL;

CREATE INDEX IF NOT EXISTS idx_pago_fecha_emision_cuota
ON pago_cuota(fecha_emision_cuota);
