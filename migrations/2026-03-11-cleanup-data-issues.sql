# Migration: Limpieza de datos problemáticos antes de aplicar constraints
# Fecha: 2026-03-11
# Propósito: Eliminar/corregir datos que violarían los nuevos constraints
# ADVERTENCIA: Ejecutar con precaución y siempre con backup previo

-- ========================================================================
-- INSTRUCCIONES PREVIAS
-- ========================================================================
-- 1. Hacer BACKUP completo de la base de datos antes de ejecutar
-- 2. Ejecutar primero 2026-03-11-detect-data-issues.sql para identificar problemas
-- 3. Revisar los resultados y ajustar según sea necesario
-- 4. Ejecutar este script sección por sección, verificando cada paso

BEGIN;

-- ========================================================================
-- 1) LIMPIAR CUOTAS DUPLICADAS (P-001)
-- ========================================================================
-- Estrategia: Mantener la cuota más reciente (mayor id_cuota) por socio/período
--             Si tiene pagos, mantener la que tiene más pagos

-- 1a) Crear tabla temporal con las cuotas a mantener
CREATE TEMP TABLE cuotas_a_mantener AS
SELECT DISTINCT ON (id_socio, periodo)
    id_cuota
FROM cuota
ORDER BY id_socio, periodo, id_cuota DESC;

-- 1b) Verificar cuántos registros se eliminarían
SELECT 
    COUNT(*) AS cuotas_a_eliminar,
    (SELECT COUNT(*) FROM cuota) - COUNT(*) AS cuotas_mantenidas
FROM cuota
WHERE id_cuota IN (SELECT id_cuota FROM cuotas_a_mantener);

-- 1c) IMPORTANTE: Verificar que no hay pagos asociados a las cuotas que se eliminarían
-- Si hay pagos, considerar fusionar o recalcular en lugar de eliminar
SELECT 
    c.id_cuota,
    c.id_socio,
    c.periodo,
    c.monto,
    c.estado,
    COUNT(pc.id_pago) AS cantidad_pagos,
    COALESCE(SUM(pc.monto_pagado), 0) AS total_pagado
FROM cuota c
LEFT JOIN pago_cuota pc ON pc.id_cuota = c.id_cuota
WHERE c.id_cuota NOT IN (SELECT id_cuota FROM cuotas_a_mantener)
GROUP BY c.id_cuota, c.id_socio, c.periodo, c.monto, c.estado
ORDER BY c.id_socio, c.periodo;

-- 1d) Si hay cuotas duplicadas con pagos, usar esta estrategia alternativa:
-- Mantener la que tiene más pagos, o la más reciente si hay empate
DROP TABLE IF EXISTS cuotas_a_mantener;
CREATE TEMP TABLE cuotas_a_mantener AS
SELECT DISTINCT ON (id_socio, periodo)
    id_cuota
FROM (
    SELECT 
        c.id_cuota,
        c.id_socio,
        c.periodo,
        COUNT(pc.id_pago) AS num_pagos
    FROM cuota c
    LEFT JOIN pago_cuota pc ON pc.id_cuota = c.id_cuota
    GROUP BY c.id_cuota, c.id_socio, c.periodo
) ranked
ORDER BY id_socio, periodo, num_pagos DESC, id_cuota DESC;

-- 1e) Eliminar cuotas duplicadas (DESComentar para ejecutar)
-- ADVERTENCIA: Verificar resultados de queries anteriores antes de descomentar
-- DELETE FROM cuota
-- WHERE id_cuota NOT IN (SELECT id_cuota FROM cuotas_a_mantener);

-- Limpieza
DROP TABLE IF EXISTS cuotas_a_mantener;

-- ========================================================================
-- 2) LIMPIAR INSCRIPCIONES DUPLICADAS EN SOCIO_TEMPORADA (P-002)
-- ========================================================================
-- Estrategia: Mantener la inscripción más reciente (mayor id_socio_temporada)

-- 2a) Crear tabla temporal con las inscripciones a mantener
CREATE TEMP TABLE inscripciones_a_mantener AS
SELECT DISTINCT ON (id_socio, id_temporada)
    id_socio_temporada
FROM socio_temporada
ORDER BY id_socio, id_temporada, id_socio_temporada DESC;

-- 2b) Verificar cuántos registros se eliminarían
SELECT 
    COUNT(*) AS inscripciones_a_eliminar,
    (SELECT COUNT(*) FROM socio_temporada) - COUNT(*) AS inscripciones_mantenidas
FROM socio_temporada
WHERE id_socio_temporada NOT IN (SELECT id_socio_temporada FROM inscripciones_a_mantener);

-- 2c) Eliminar inscripciones duplicadas (DESComentar para ejecutar)
-- ADVERTENCIA: Verificar resultados del query anterior antes de descomentar
-- DELETE FROM socio_temporada
-- WHERE id_socio_temporada NOT IN (SELECT id_socio_temporada FROM inscripciones_a_mantener);

-- Limpieza
DROP TABLE IF EXISTS inscripciones_a_mantener;

-- ========================================================================
-- 3) CORREGIR LÍNEAS DE COBRO INVÁLIDAS (P-005)
-- ========================================================================

-- 3a) Líneas CUOTA sin id_cuota - Convertir a CONCEPTO si tienen concepto
UPDATE cobro_operacion_linea
SET 
    tipo_linea = 'CONCEPTO',
    concepto = COALESCE(concepto, 'Cuota sin referencia')
WHERE tipo_linea = 'CUOTA' 
  AND id_cuota IS NULL 
  AND concepto IS NOT NULL;

-- 3b) Líneas CUOTA sin id_cuota NI concepto - Marcar para revisión manual
-- (No se pueden corregir automáticamente)
UPDATE cobro_operacion_linea
SET concepto = 'PENDIENTE REVISIÓN - Línea sin cuota ni concepto'
WHERE tipo_linea = 'CUOTA' 
  AND id_cuota IS NULL 
  AND (concepto IS NULL OR concepto = '');

-- 3c) Líneas CONCEPTO sin concepto - Asignar concepto genérico
UPDATE cobro_operacion_linea
SET concepto = 'Concepto no especificado'
WHERE tipo_linea = 'CONCEPTO' 
  AND (concepto IS NULL OR concepto = '');

-- 3d) Líneas híbridas (tienen ambos campos) - Limpiar según tipo
-- Si es CUOTA, limpiar concepto
UPDATE cobro_operacion_linea
SET concepto = NULL
WHERE tipo_linea = 'CUOTA' 
  AND id_cuota IS NOT NULL 
  AND concepto IS NOT NULL;

-- Si es CONCEPTO, limpiar id_cuota
UPDATE cobro_operacion_linea
SET id_cuota = NULL
WHERE tipo_linea = 'CONCEPTO' 
  AND concepto IS NOT NULL 
  AND id_cuota IS NOT NULL;

-- ========================================================================
-- 4) CORREGIR SOCIOS CON TARJETA_CENTRO SIN NÚMERO (P-008)
-- ========================================================================

-- 4a) Opción 1: Desactivar tarjeta_centro si no hay número
UPDATE socio
SET tarjeta_centro = false
WHERE tarjeta_centro = true 
  AND (numero_tarjeta_centro IS NULL OR numero_tarjeta_centro = '');

-- 4b) Opción 2: Si se prefiere mantener el flag, asignar número pendiente
-- (Descomentar si se prefiere esta opción en lugar de la anterior)
-- UPDATE socio
-- SET numero_tarjeta_centro = 'PENDIENTE_ASIGNAR'
-- WHERE tarjeta_centro = true 
--   AND (numero_tarjeta_centro IS NULL OR numero_tarjeta_centro = '');

-- ========================================================================
-- 5) CORREGIR INCONSISTENCIAS EN PAGO_CUOTA (P-003)
-- ========================================================================

-- 5a) Sincronizar metodo_pago con cobro_operacion cuando difieren
UPDATE pago_cuota pc
SET id_metodo_pago = co.id_metodo_pago
FROM cobro_operacion co
WHERE pc.id_cobro_operacion = co.id_cobro_operacion
  AND pc.id_cobro_operacion IS NOT NULL
  AND pc.id_metodo_pago IS NOT NULL
  AND pc.id_metodo_pago != co.id_metodo_pago;

-- 5b) Sincronizar cobrador con cobro_operacion cuando difieren
UPDATE pago_cuota pc
SET id_cobrador = co.id_cobrador
FROM cobro_operacion co
WHERE pc.id_cobro_operacion = co.id_cobro_operacion
  AND pc.id_cobro_operacion IS NOT NULL
  AND pc.id_cobrador IS NOT NULL
  AND co.id_cobrador IS NOT NULL
  AND pc.id_cobrador != co.id_cobrador;

-- 5c) Opcional: Hacer NULL los campos redundantes cuando hay cobro_operacion
-- (La aplicación debería tomar estos datos de cobro_operacion)
-- UPDATE pago_cuota
-- SET id_metodo_pago = NULL, id_cobrador = NULL
-- WHERE id_cobro_operacion IS NOT NULL;

-- ========================================================================
-- 6) VERIFICACIÓN FINAL
-- ========================================================================
-- Ejecutar estos queries para verificar que no quedan datos problemáticos

SELECT 'Cuotas duplicadas' AS check_type, 
       CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'PENDIENTE: ' || COUNT(*) || ' grupos' END AS estado
FROM (
    SELECT id_socio, periodo FROM cuota GROUP BY id_socio, periodo HAVING COUNT(*) > 1
) t

UNION ALL

SELECT 'Inscripciones duplicadas', 
       CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'PENDIENTE: ' || COUNT(*) || ' grupos' END
FROM (
    SELECT id_socio, id_temporada FROM socio_temporada GROUP BY id_socio, id_temporada HAVING COUNT(*) > 1
) t

UNION ALL

SELECT 'Líneas CUOTA sin id_cuota', 
       CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'PENDIENTE: ' || COUNT(*) || ' registros' END
FROM cobro_operacion_linea WHERE tipo_linea = 'CUOTA' AND id_cuota IS NULL

UNION ALL

SELECT 'Líneas CONCEPTO sin concepto', 
       CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'PENDIENTE: ' || COUNT(*) || ' registros' END
FROM cobro_operacion_linea WHERE tipo_linea = 'CONCEPTO' AND (concepto IS NULL OR concepto = '')

UNION ALL

SELECT 'Socios con tarjeta sin número', 
       CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'PENDIENTE: ' || COUNT(*) || ' registros' END
FROM socio WHERE tarjeta_centro = true AND (numero_tarjeta_centro IS NULL OR numero_tarjeta_centro = '');

COMMIT;

-- ========================================================================
-- NOTAS IMPORTANTES
-- ========================================================================
-- 1. Este script hace COMMIT al final. Para pruebas, cambiar COMMIT por ROLLBACK
-- 2. Las secciones 1d) y 2c) están comentadas por seguridad - descomentar solo
--    después de verificar los datos que se eliminarán
-- 3. Mantener un log de los cambios realizados para auditoría
-- 4. Después de ejecutar, correr 2026-03-11-detect-data-issues.sql para verificar
