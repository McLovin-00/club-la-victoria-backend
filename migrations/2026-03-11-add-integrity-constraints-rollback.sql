# Migration: Rollback de constraints de integridad
# Fecha: 2026-03-11
# Proyecto: Club La Victoria
# Propósito: Revertir los cambios realizados por 2026-03-11-add-integrity-constraints.sql
# ADVERTENCIA: Solo ejecutar si hay problemas con la migración principal

-- ========================================================================
-- ROLLBACK COMPLETO
-- ========================================================================
-- Este script elimina todos los constraints e índices agregados por la
-- migración 2026-03-11-add-integrity-constraints.sql
-- 
-- ORDEN: Inverso a la creación para evitar dependencias

BEGIN;

-- ========================================================================
-- FASE 4: ELIMINAR COMENTARIOS
-- ========================================================================

COMMENT ON COLUMN cobro_operacion.id_metodo_pago IS NULL;
COMMENT ON CONSTRAINT uq_cuota_socio_periodo ON cuota IS NULL;
COMMENT ON CONSTRAINT uq_socio_temporada ON socio_temporada IS NULL;
COMMENT ON CONSTRAINT chk_tipo_linea_condicional ON cobro_operacion_linea IS NULL;
COMMENT ON CONSTRAINT chk_tarjeta_centro_numero ON socio IS NULL;
COMMENT ON CONSTRAINT chk_pago_cuota_consistencia ON pago_cuota IS NULL;

-- ========================================================================
-- FASE 3: ELIMINAR ÍNDICES (solo los creados en esta migración)
-- ========================================================================

-- Índices para morosidad
DROP INDEX IF EXISTS idx_cuota_socio_estado;
DROP INDEX IF EXISTS idx_cuota_periodo_estado;

-- Índices para registro de ingresos
DROP INDEX IF EXISTS idx_registro_fecha_socio;
DROP INDEX IF EXISTS idx_registro_fecha_dni;

-- Índices para cobranzas móviles
DROP INDEX IF EXISTS idx_cobro_operacion_cobrador_fecha;

-- Índices para notificaciones
DROP INDEX IF EXISTS idx_notificacion_socio_leida;

-- ========================================================================
-- FASE 2: ELIMINAR CHECK CONSTRAINTS
-- ========================================================================

-- P-003: Consistencia en pago_cuota
ALTER TABLE pago_cuota 
    DROP CONSTRAINT IF EXISTS chk_pago_cuota_consistencia;

-- P-008: Validación tarjeta_centro en socio
ALTER TABLE socio 
    DROP CONSTRAINT IF EXISTS chk_tarjeta_centro_numero;

-- P-005: Validación condicional en cobro_operacion_linea
ALTER TABLE cobro_operacion_linea 
    DROP CONSTRAINT IF EXISTS chk_tipo_linea_condicional;

-- ========================================================================
-- FASE 1: ELIMINAR UNIQUE CONSTRAINTS
-- ========================================================================

-- P-002: UNIQUE en socio_temporada
ALTER TABLE socio_temporada 
    DROP CONSTRAINT IF EXISTS uq_socio_temporada;

-- Eliminar el índice subyacente si quedó huérfano
DROP INDEX IF EXISTS uq_socio_temporada;

-- P-001: UNIQUE en cuota
ALTER TABLE cuota 
    DROP CONSTRAINT IF EXISTS uq_cuota_socio_periodo;

-- Eliminar el índice subyacente si quedó huérfano
DROP INDEX IF EXISTS uq_cuota_socio_periodo;

COMMIT;

-- ========================================================================
-- VERIFICACIÓN POST-ROLLBACK
-- ========================================================================

-- Verificar que todos los constraints fueron eliminados
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.constraint_name IN (
    'uq_cuota_socio_periodo',
    'uq_socio_temporada',
    'chk_tipo_linea_condicional',
    'chk_tarjeta_centro_numero',
    'chk_pago_cuota_consistencia'
);

-- Debe retornar 0 filas si el rollback fue exitoso

-- Verificar que los índices fueron eliminados
SELECT 
    indexname,
    tablename
FROM pg_indexes
WHERE indexname IN (
    'uq_cuota_socio_periodo',
    'uq_socio_temporada',
    'idx_cuota_socio_estado',
    'idx_cuota_periodo_estado',
    'idx_registro_fecha_socio',
    'idx_registro_fecha_dni',
    'idx_cobro_operacion_cobrador_fecha',
    'idx_notificacion_socio_leida'
);

-- Debe retornar 0 filas si el rollback fue exitoso

-- ========================================================================
-- NOTAS
-- ========================================================================
-- 
-- 1. Este rollback NO revierte los cambios de datos realizados por
--    2026-03-11-cleanup-data-issues.sql (ese script debe revertirse manualmente
--    si es necesario, restaurando desde backup)
-- 
-- 2. Los índices UNIQUE eliminados pueden haber mejorado la performance de
--    algunas queries. Considerar recrearlos como índices no-unique si es
--    necesario.
-- 
-- 3. Después del rollback, la base de datos vuelve al estado anterior pero
--    puede haber datos duplicados que fueron limpiados. Si se restaura un
--    backup, esos datos volverán a existir.
