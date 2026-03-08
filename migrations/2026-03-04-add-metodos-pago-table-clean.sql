-- Migration: agregar tabla metodos_pago y migrar de enum a foreign key
-- Fecha: 2026-03-04

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

-- EFECTIVO (id=1)
INSERT INTO metodos_pago (nombre, descripcion, activo, orden)
VALUES ('EFECTIVO', 'Pago en efectivo en el local', true, 1)
ON CONFLICT (nombre) DO NOTHING;

-- TRANSFERENCIA (id=2)
INSERT INTO metodos_pago (nombre, descripcion, activo, orden)
VALUES ('TRANSFERENCIA', 'Transferencia bancaria', true, 2)
ON CONFLICT (nombre) DO NOTHING;

-- ========================================================================
-- 3. AGREGAR COLUMNA FK (si no existe)
-- ========================================================================

-- Agregar columna id_metodo_pago si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pago_cuota' AND column_name = 'id_metodo_pago'
  ) THEN
    ALTER TABLE pago_cuota ADD COLUMN id_metodo_pago INTEGER;
  END IF;
END $$;

-- ========================================================================
-- 4. MIGRAR DATOS EXISTENTES DE ENUM A FK
-- ========================================================================

-- EFECTIVO -> id=1
UPDATE pago_cuota SET id_metodo_pago = 1 WHERE metodo_pago = 'EFECTIVO';

-- TRANSFERENCIA -> id=2
UPDATE pago_cuota SET id_metodo_pago = 2 WHERE metodo_pago = 'TRANSFERENCIA';

-- TARJETA_DEBITO, TARJETA_CREDITO, OTRO -> NULL (obsoletos)
UPDATE pago_cuota SET id_metodo_pago = NULL WHERE metodo_pago = 'TARJETA_DEBITO';
UPDATE pago_cuota SET id_metodo_pago = NULL WHERE metodo_pago = 'TARJETA_CREDITO';
UPDATE pago_cuota SET id_metodo_pago = NULL WHERE metodo_pago = 'OTRO';

-- ========================================================================
-- 5. AGREGAR FK CONSTRAINT (si no existe)
-- ========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pago_cuota_id_metodo_pago_fkey' 
    AND table_name = 'pago_cuota'
  ) THEN
    ALTER TABLE pago_cuota 
    ADD CONSTRAINT pago_cuota_id_metodo_pago_fkey 
    FOREIGN KEY (id_metodo_pago) 
    REFERENCES metodos_pago(id_metodo_pago)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;

-- ========================================================================
-- 6. CREAR TRIGGER PARA updated_at AUTOMÁTICO
-- ========================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_metodos_pago_updated_at ON metodos_pago;
CREATE TRIGGER update_metodos_pago_updated_at
  BEFORE UPDATE ON metodos_pago
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================================================
-- 7. CREAR ÍNDICE PARA PERFORMANCE
-- ========================================================================

CREATE INDEX IF NOT EXISTS idx_pago_cuota_id_metodo_pago
  ON pago_cuota(id_metodo_pago);

-- ========================================================================
-- 8. ELIMINAR COLUMNA metodo_pago (enum antiguo)
-- ========================================================================

-- Descomentar la siguiente línea si querés eliminar la columna antigua
-- ALTER TABLE pago_cuota DROP COLUMN IF EXISTS metodo_pago;
