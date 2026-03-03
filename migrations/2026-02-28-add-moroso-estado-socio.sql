-- Migración: Agregar estado MOROSO al socio
-- Fecha: 2026-02-28
-- Descripción:
--   1) Agrega MOROSO al enum de estado del socio.
--   2) Migra a MOROSO los socios INACTIVO con 4+ cuotas pendientes,
--      para alinearse con la nueva regla de negocio.

-- Agregar valor MOROSO al enum (PostgreSQL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'socio_estado_enum'
  ) THEN
    ALTER TYPE socio_estado_enum ADD VALUE IF NOT EXISTS 'MOROSO';
  END IF;
END
$$;

-- Si la columna estado es VARCHAR/TEXT con constraint CHECK, este ALTER
-- asegura que el default siga consistente.
ALTER TABLE socio
ALTER COLUMN estado SET DEFAULT 'ACTIVO';

-- Migración de datos: socios que quedaron INACTIVO por la lógica anterior
-- y tienen 4+ cuotas pendientes pasan a MOROSO.
UPDATE socio s
SET estado = 'MOROSO'
WHERE s.estado = 'INACTIVO'
  AND EXISTS (
    SELECT 1
    FROM cuota c
    WHERE c.id_socio = s.id_socio
      AND c.estado = 'PENDIENTE'
    GROUP BY c.id_socio
    HAVING COUNT(*) >= 4
  );
