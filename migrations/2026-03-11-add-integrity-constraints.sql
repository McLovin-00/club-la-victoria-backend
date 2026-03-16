# Migration: Agregar constraints de integridad a la base de datos
# Fecha: 2026-03-11
# Proyecto: Club La Victoria
# Propósito: Implementar constraints para garantizar integridad de datos (3NF)
# Prerrequisitos: 
#   1. Ejecutar 2026-03-11-detect-data-issues.sql
#   2. Ejecutar 2026-03-11-cleanup-data-issues.sql
#   3. Verificar que no hay datos problemáticos

-- ========================================================================
-- FASE 1: CONSTRAINTS CRÍTICOS (UNIQUE)
-- ========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- P-001: UNIQUE constraint en cuota(id_socio, periodo)
-- -------------------------------------------------------------------------
-- Previene: Cuotas duplicadas para mismo socio/período
-- Impacto: CRÍTICO - evita inconsistencias en cobranza

-- Estrategia: Crear índice UNIQUE concurrente para minimizar bloqueos
-- Nota: En producción con tabla grande, usar CONCURRENTLY y ejecutar por separado
-- CREATE UNIQUE INDEX CONCURRENTLY uq_cuota_socio_periodo ON cuota(id_socio, periodo);

-- Para migración en ventana de mantenimiento, usar esta versión:
CREATE UNIQUE INDEX IF NOT EXISTS uq_cuota_socio_periodo 
    ON cuota(id_socio, periodo);

-- Agregar constraint usando el índice existente (instantáneo)
ALTER TABLE cuota 
    DROP CONSTRAINT IF EXISTS uq_cuota_socio_periodo,
    ADD CONSTRAINT uq_cuota_socio_periodo 
        UNIQUE USING INDEX uq_cuota_socio_periodo;

-- -------------------------------------------------------------------------
-- P-002: UNIQUE constraint en socio_temporada(id_socio, id_temporada)
-- -------------------------------------------------------------------------
-- Previene: Inscripciones duplicadas del mismo socio a la misma temporada
-- Impacto: CRÍTICO - evita inconsistencias en temporadas de pileta

CREATE UNIQUE INDEX IF NOT EXISTS uq_socio_temporada 
    ON socio_temporada(id_socio, id_temporada);

ALTER TABLE socio_temporada 
    DROP CONSTRAINT IF EXISTS uq_socio_temporada,
    ADD CONSTRAINT uq_socio_temporada 
        UNIQUE USING INDEX uq_socio_temporada;

COMMIT;

-- ========================================================================
-- FASE 2: CONSTRAINTS ALTOS (CHECK)
-- ========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- P-005: CHECK constraint en cobro_operacion_linea para tipo_linea condicional
-- -------------------------------------------------------------------------
-- Previene: Líneas de cobro inválidas
-- Regla:
--   - Si tipo_linea = 'CUOTA' → id_cuota NOT NULL, concepto NULL
--   - Si tipo_linea = 'CONCEPTO' → concepto NOT NULL, id_cuota NULL
-- Impacto: ALTO - garantiza consistencia en operaciones de cobro

ALTER TABLE cobro_operacion_linea 
    DROP CONSTRAINT IF EXISTS chk_tipo_linea_condicional,
    ADD CONSTRAINT chk_tipo_linea_condicional
        CHECK (
            (tipo_linea = 'CUOTA' AND id_cuota IS NOT NULL AND concepto IS NULL) OR
            (tipo_linea = 'CONCEPTO' AND concepto IS NOT NULL AND id_cuota IS NULL)
        );

-- -------------------------------------------------------------------------
-- P-008: CHECK constraint en socio para tarjeta_centro condicional
-- -------------------------------------------------------------------------
-- Previene: Socios con tarjeta_centro = true pero sin número de tarjeta
-- Regla: Si tarjeta_centro = true → numero_tarjeta_centro NOT NULL
-- Impacto: MEDIO - garantiza consistencia en datos de Tarjeta del Centro

ALTER TABLE socio 
    DROP CONSTRAINT IF EXISTS chk_tarjeta_centro_numero,
    ADD CONSTRAINT chk_tarjeta_centro_numero
        CHECK (
            NOT tarjeta_centro 
            OR numero_tarjeta_centro IS NOT NULL
        );

-- -------------------------------------------------------------------------
-- P-003: CHECK constraint en pago_cuota para consistencia con cobro_operacion
-- -------------------------------------------------------------------------
-- Previene: Inconsistencias entre pago_cuota y cobro_operacion
-- Regla: Si hay cobro_operacion, metodo_pago y cobrador deben ser NULL
--        (se obtienen de cobro_operacion) o coincidir con ella
-- Impacto: ALTO - elimina ambigüedad en fuente de datos

ALTER TABLE pago_cuota 
    DROP CONSTRAINT IF EXISTS chk_pago_cuota_consistencia,
    ADD CONSTRAINT chk_pago_cuota_consistencia
        CHECK (
            id_cobro_operacion IS NULL 
            OR (
                -- Si hay operación, metodo_pago es opcional (se toma de la operación)
                id_metodo_pago IS NULL 
                -- cobrador también es opcional
                AND id_cobrador IS NULL
            )
        );

COMMIT;

-- ========================================================================
-- FASE 3: ÍNDICES PARA PERFORMANCE
-- ========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- Índices para consultas de morosidad (muy usados)
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cuota_socio_estado 
    ON cuota(id_socio, estado);

CREATE INDEX IF NOT EXISTS idx_cuota_periodo_estado 
    ON cuota(periodo, estado);

-- -------------------------------------------------------------------------
-- Índices para registro de ingresos
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_registro_fecha_socio 
    ON registro_ingreso(fecha_hora_ingreso, id_socio);

CREATE INDEX IF NOT EXISTS idx_registro_fecha_dni 
    ON registro_ingreso(fecha_hora_ingreso, dni_no_socio);

-- -------------------------------------------------------------------------
-- Índices para cobranzas móviles
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cobro_operacion_cobrador_fecha 
    ON cobro_operacion(id_cobrador, fecha_hora_servidor);

-- -------------------------------------------------------------------------
-- Índices para notificaciones no leídas
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_notificacion_socio_leida 
    ON notificacion(socio_id, leida);

COMMIT;

-- ========================================================================
-- FASE 4: COMENTARIOS DOCUMENTALES
-- ========================================================================

-- Documentar el propósito del campo metodo_pago_id en cobro_operacion
COMMENT ON COLUMN cobro_operacion.id_metodo_pago IS 
    'Primer método de pago utilizado en la operación. Para pagos mixtos (múltiples métodos), ver detalle en pago_cuota. Campo conservado por compatibilidad con reportes existentes.';

-- Documentar los nuevos constraints
COMMENT ON CONSTRAINT uq_cuota_socio_periodo ON cuota IS 
    'Garantiza que no existan cuotas duplicadas para el mismo socio en el mismo período. Previene errores en concurrencia.';

COMMENT ON CONSTRAINT uq_socio_temporada ON socio_temporada IS 
    'Garantiza que un socio no pueda inscribirse múltiples veces a la misma temporada.';

COMMENT ON CONSTRAINT chk_tipo_linea_condicional ON cobro_operacion_linea IS 
    'Valida que las líneas de tipo CUOTA tengan id_cuota y las de tipo CONCEPTO tengan concepto, pero no ambos.';

COMMENT ON CONSTRAINT chk_tarjeta_centro_numero ON socio IS 
    'Valida que si un socio tiene tarjeta_centro = true, debe tener un número de tarjeta asignado.';

COMMENT ON CONSTRAINT chk_pago_cuota_consistencia ON pago_cuota IS 
    'Valida que si un pago está asociado a una cobro_operacion, los campos metodo_pago y cobrador deben ser NULL (se obtienen de la operación).';

-- ========================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ========================================================================

-- Verificar que todos los constraints fueron creados correctamente
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_name IN (
    'uq_cuota_socio_periodo',
    'uq_socio_temporada',
    'chk_tipo_linea_condicional',
    'chk_tarjeta_centro_numero',
    'chk_pago_cuota_consistencia'
)
ORDER BY tc.table_name, tc.constraint_name;

-- Verificar que todos los índices fueron creados
SELECT 
    indexname,
    tablename,
    indexdef
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
)
ORDER BY tablename, indexname;

-- ========================================================================
-- NOTAS DE IMPLEMENTACIÓN
-- ========================================================================
-- 
-- ORDEN DE EJECUCIÓN RECOMENDADO:
-- 1. Backup completo de la base de datos
-- 2. Ejecutar 2026-03-11-detect-data-issues.sql
-- 3. Revisar y documentar datos problemáticos encontrados
-- 4. Ejecutar 2026-03-11-cleanup-data-issues.sql
-- 5. Verificar que no quedan datos problemáticos
-- 6. Ejecutar ESTE script (2026-03-11-add-integrity-constraints.sql)
-- 7. Ejecutar queries de verificación al final de este script
-- 8. Probar aplicación para verificar funcionamiento
-- 
-- ROLLBACK: Si hay problemas, ejecutar 2026-03-11-add-integrity-constraints-rollback.sql
-- 
-- TIEMPO ESTIMADO:
-- - Fase 1 (UNIQUE): ~1-5 segundos por tabla (depende del tamaño)
-- - Fase 2 (CHECK): Instantáneo
-- - Fase 3 (Índices): ~5-30 segundos por índice (depende del tamaño)
-- - Total: ~1-5 minutos en base de datos mediana
