# Rollback Migration: Tabla metodos_pago
# Fecha: 2026-03-04
# MIGRACIÓN REVERTIDA: Por problemas de conectividad con PostgreSQL

# ========================================================================
# 1. ELIMINAR TABLA metodos_pago
# ========================================================================

DROP TABLE IF EXISTS metodos_pago CASCADE;

# ========================================================================
# 2. ELIMINAR COLUMNA FK Y ENUM DE pago_cuota
# ========================================================================

ALTER TABLE pago_cuota
DROP COLUMN IF EXISTS id_metodo_pago;

# ========================================================================
# 3. RESTAURAR COLUMNA ENUM metodo_pago (si fue eliminada)
# ========================================================================

-- Si la columna metodo_pago fue eliminada durante la migración, restaurarla
ALTER TABLE pago_cuota
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50) DEFAULT NULL;

# ========================================================================
# 4. RESTAURAR DATOS ORIGINALES
# ========================================================================

-- Restaurar valores de metodo_pago que fueron setead a NULL
UPDATE pago_cuota
SET metodo_pago = 'EFECTIVO'
WHERE id_metodo_pago = 1;

UPDATE pago_cuota
SET metodo_pago = 'TRANSFERENCIA'
WHERE id_metodo_pago = 2;

UPDATE pago_cuota
SET metodo_pago = 'TARJETA_DEBITO'
WHERE id_metodo_pago IS NULL;

UPDATE pago_cuota
SET metodo_pago = 'TARJETA_CREDITO'
WHERE id_metodo_pago IS NULL;

UPDATE pago_cuota
SET metodo_pago = 'OTRO'
WHERE id_metodo_pago IS NULL;

# ========================================================================
# 5. ELIMINAR TRIGGER updated_at DE metodos_pago
# ========================================================================

DROP TRIGGER IF EXISTS update_metodos_pago_updated_at ON metodos_pago;

DROP FUNCTION IF EXISTS update_updated_at_column();

# ========================================================================
# 6. ELIMINAR ÍNDICE
# ========================================================================

DROP INDEX IF EXISTS idx_pago_cuota_id_metodo_pago;

# ========================================================================
# NOTAS DE ROLLBACK:
# ========================================================================
# 1. Se eliminó la tabla metodos_pago CASCADE (elimina también FKs)
# 2. Se eliminó la columna id_metodo_pago de pago_cuota
# 3. Se restauró la columna metodo_pago con valores originales
# 4. Se restauraron los datos de metodo_pago desde id_metodo_pago
# 5. Se eliminaron el trigger y función de updated_at
# 6. Se eliminó el índice de performance
# ========================================================================
