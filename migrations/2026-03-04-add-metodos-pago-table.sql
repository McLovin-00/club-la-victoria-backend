# Migration: agregar tabla metodos_pago y migrar de enum a foreign key
# Fecha: 2026-03-04

-- ========================================================================
-- 1. CREAR TABLA metodos_pago
-- ========================================================================

CREATE TABLE IF NOT EXISTS metodos_pago (
  id_metodo_pago SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ========================================================================
-- 2. INSERTAR METODOS DE PAGO INICIALES
-- ========================================================================

-- EFECTIVO (id=1) - Método más común en este club
INSERT INTO metodos_pago (nombre, descripcion, activo, orden)
VALUES ('EFECTIVO', 'Pago en efectivo en el local', true, 1)
ON CONFLICT (nombre) DO NOTHING;

-- TRANSFERENCIA (id=2) - Método tradicional
INSERT INTO metodos_pago (nombre, descripcion, activo, orden)
VALUES ('TRANSFERENCIA', 'Transferencia bancaria', true, 2)
ON CONFLICT (nombre) DO NOTHING;

-- ========================================================================
-- 3. MIGRAR DATOS EXISTENTES DE ENUM A FK
-- ========================================================================

-- EFECTIVO y TRANSFERENCIA: migrar directamente (existen en la tabla)
UPDATE pago_cuota
SET id_metodo_pago = 1
WHERE metodo_pago = 'EFECTIVO';

UPDATE pago_cuota
SET id_metodo_pago = 2
WHERE metodo_pago = 'TRANSFERENCIA';

-- TARJETA_DEBITO: método obsoleto - setear NULL temporalmente
UPDATE pago_cuota
SET id_metodo_pago = NULL
WHERE metodo_pago = 'TARJETA_DEBITO';

-- TARJETA_CREDITO: método obsoleto - setear NULL temporalmente
UPDATE pago_cuota
SET id_metodo_pago = NULL
WHERE metodo_pago = 'TARJETA_CREDITO';

-- OTRO: método obsoleto - setear NULL temporalmente
UPDATE pago_cuota
SET id_metodo_pago = NULL
WHERE metodo_pago = 'OTRO';

-- ========================================================================
-- 4. ELIMINAR COLUMNA ENUM Y AGREGAR FK
-- ========================================================================

-- Agregar columna FK temporal para asegurar integridad
ALTER TABLE pago_cuota
ADD COLUMN id_metodo_pago INTEGER REFERENCES metodos_pago(id_metodo_pago)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- ========================================================================
-- 5. CREAR TRIGGER PARA updated_at AUTOMÁTICO
-- ========================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_metodos_pago_updated_at
  BEFORE UPDATE ON metodos_pago
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================================================
-- 6. CREAR ÍNDICE PARA PERFORMANCE
-- ========================================================================

CREATE INDEX IF NOT EXISTS idx_pago_cuota_id_metodo_pago
  ON pago_cuota(id_metodo_pago);

-- ========================================================================
-- 7. VERIFICACIÓN DE MIGRACIÓN (Opcional - descomentar para ejecutar)
-- ========================================================================

-- SELECT
--   COUNT(*) as total_pagos,
--   COUNT(CASE WHEN id_metodo_pago = 1 THEN 1 END) as pagos_efectivo,
--   COUNT(CASE WHEN id_metodo_pago = 2 THEN 1 END) as pagos_transferencia,
--   COUNT(CASE WHEN id_metodo_pago IS NULL THEN 1 END) as pagos_obsoletos_null
-- FROM pago_cuota;

-- SELECT * FROM metodos_pago ORDER BY orden;

-- ========================================================================
-- NOTAS DE LA MIGRACIÓN:
-- ========================================================================
-- 1. Se conservan todos los pagos históricos - los métodos obsoletos
--    se marcan como NULL para preservar integridad histórica.
-- 2. Los pagos con EFECTIVO y TRANSFERENCIA se migran directamente a
--    sus IDs correspondientes.
-- 3. La FK tiene ON DELETE RESTRICT para evitar eliminar métodos
--    que tengan pagos asociados.
-- 4. ON UPDATE CASCADE garantiza que si cambia un id_metodo_pago,
--    se actualicen todos los pagos asociados automáticamente.
-- 5. El índice optimiza queries que filtran por método de pago.
-- 6. El trigger mantiene la columna updated_at siempre actualizada.
-- 7. La restricción UNIQUE en nombre asegura no duplicados.
-- 8. El campo orden permite reordenar métodos en listados futuros.
-- ========================================================================
