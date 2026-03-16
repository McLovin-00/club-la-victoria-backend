# Migration: Detección de datos problemáticos antes de aplicar constraints
# Fecha: 2026-03-11
# Propósito: Identificar datos que violarían los nuevos constraints

-- ========================================================================
-- 1) DETECTAR CUOTAS DUPLICADAS (P-001)
-- ========================================================================
-- Problema: Múltiples cuotas para mismo socio/período
-- Solución: Eliminar duplicados manteniendo el más reciente

SELECT 
    c.id_socio,
    c.periodo,
    COUNT(*) AS cantidad_duplicados,
    STRING_AGG(c.id_cuota::TEXT, ', ' ORDER BY c.id_cuota) AS ids_cuotas,
    MIN(c.created_at) AS primera_creacion,
    MAX(c.created_at) AS ultima_creacion
FROM cuota c
GROUP BY c.id_socio, c.periodo
HAVING COUNT(*) > 1
ORDER BY cantidad_duplicados DESC, c.id_socio, c.periodo;

-- ========================================================================
-- 2) DETECTAR INSCRIPCIONES DUPLICADAS EN SOCIO_TEMPORADA (P-002)
-- ========================================================================
-- Problema: Múltiples inscripciones del mismo socio a la misma temporada
-- Solución: Eliminar duplicados manteniendo el más reciente

SELECT 
    st.id_socio,
    st.id_temporada,
    COUNT(*) AS cantidad_duplicados,
    STRING_AGG(st.id_socio_temporada::TEXT, ', ' ORDER BY st.id_socio_temporada) AS ids_inscripciones,
    MIN(st.fecha_hora_inscripcion) AS primera_inscripcion,
    MAX(st.fecha_hora_inscripcion) AS ultima_inscripcion
FROM socio_temporada st
GROUP BY st.id_socio, st.id_temporada
HAVING COUNT(*) > 1
ORDER BY cantidad_duplicados DESC, st.id_socio, st.id_temporada;

-- ========================================================================
-- 3) DETECTAR LÍNEAS DE COBRO INVÁLIDAS (P-005)
-- ========================================================================
-- Problema: Líneas que no cumplen la regla condicional:
--   - Si tipo_linea = 'CUOTA' → id_cuota NOT NULL, concepto NULL
--   - Si tipo_linea = 'CONCEPTO' → concepto NOT NULL, id_cuota NULL

-- 3a) CUOTA sin id_cuota (CRÍTICO)
SELECT 
    col.id_cobro_operacion_linea,
    col.id_cobro_operacion,
    col.tipo_linea,
    col.id_cuota,
    col.concepto,
    col.monto
FROM cobro_operacion_linea col
WHERE col.tipo_linea = 'CUOTA' AND col.id_cuota IS NULL;

-- 3b) CONCEPTO sin concepto (CRÍTICO)
SELECT 
    col.id_cobro_operacion_linea,
    col.id_cobro_operacion,
    col.tipo_linea,
    col.id_cuota,
    col.concepto,
    col.monto
FROM cobro_operacion_linea col
WHERE col.tipo_linea = 'CONCEPTO' AND (col.concepto IS NULL OR col.concepto = '');

-- 3c) CUOTA con concepto (ADVERTENCIA - híbrido confuso)
SELECT 
    col.id_cobro_operacion_linea,
    col.id_cobro_operacion,
    col.tipo_linea,
    col.id_cuota,
    col.concepto,
    col.monto
FROM cobro_operacion_linea col
WHERE col.tipo_linea = 'CUOTA' AND col.id_cuota IS NOT NULL AND col.concepto IS NOT NULL;

-- 3d) CONCEPTO con id_cuota (ADVERTENCIA - híbrido confuso)
SELECT 
    col.id_cobro_operacion_linea,
    col.id_cobro_operacion,
    col.tipo_linea,
    col.id_cuota,
    col.concepto,
    col.monto
FROM cobro_operacion_linea col
WHERE col.tipo_linea = 'CONCEPTO' AND col.concepto IS NOT NULL AND col.id_cuota IS NOT NULL;

-- ========================================================================
-- 4) DETECTAR SOCIOS CON TARJETA_CENTRO SIN NÚMERO (P-008)
-- ========================================================================
-- Problema: Socios con tarjeta_centro = true pero sin numero_tarjeta_centro

SELECT 
    s.id_socio,
    s.nombre,
    s.apellido,
    s.dni,
    s.tarjeta_centro,
    s.numero_tarjeta_centro
FROM socio s
WHERE s.tarjeta_centro = true AND (s.numero_tarjeta_centro IS NULL OR s.numero_tarjeta_centro = '');

-- ========================================================================
-- 5) DETECTAR INCONSISTENCIAS EN PAGO_CUOTA (P-003)
-- ========================================================================
-- Problema: pago_cuota con metodo_pago/cobrador que difiere de cobro_operacion

-- 5a) Pago con operación pero metodo_pago diferente
SELECT 
    pc.id_pago,
    pc.id_cuota,
    pc.id_cobro_operacion,
    pc.id_metodo_pago AS pago_metodo,
    co.id_metodo_pago AS operacion_metodo,
    CASE WHEN pc.id_metodo_pago != co.id_metodo_pago THEN 'INCONSISTENTE' ELSE 'OK' END AS estado
FROM pago_cuota pc
JOIN cobro_operacion co ON pc.id_cobro_operacion = co.id_cobro_operacion
WHERE pc.id_cobro_operacion IS NOT NULL 
  AND pc.id_metodo_pago IS NOT NULL
  AND pc.id_metodo_pago != co.id_metodo_pago;

-- 5b) Pago con operación pero cobrador diferente
SELECT 
    pc.id_pago,
    pc.id_cuota,
    pc.id_cobro_operacion,
    pc.id_cobrador AS pago_cobrador,
    co.id_cobrador AS operacion_cobrador,
    CASE WHEN pc.id_cobrador != co.id_cobrador THEN 'INCONSISTENTE' ELSE 'OK' END AS estado
FROM pago_cuota pc
JOIN cobro_operacion co ON pc.id_cobro_operacion = co.id_cobro_operacion
WHERE pc.id_cobro_operacion IS NOT NULL 
  AND pc.id_cobrador IS NOT NULL
  AND co.id_cobrador IS NOT NULL
  AND pc.id_cobrador != co.id_cobrador;

-- ========================================================================
-- 6) DETECTAR OPERACIONES CON TOTAL INCONSISTENTE (P-004)
-- ========================================================================
-- Problema: total en cobro_operacion no coincide con suma de líneas

SELECT 
    co.id_cobro_operacion,
    co.id_socio,
    co.total AS total_operacion,
    COALESCE(SUM(col.monto), 0) AS suma_lineas,
    co.total - COALESCE(SUM(col.monto), 0) AS diferencia
FROM cobro_operacion co
LEFT JOIN cobro_operacion_linea col ON col.id_cobro_operacion = co.id_cobro_operacion
GROUP BY co.id_cobro_operacion, co.id_socio, co.total
HAVING co.total != COALESCE(SUM(col.monto), 0)
ORDER BY ABS(co.total - COALESCE(SUM(col.monto), 0)) DESC;

-- ========================================================================
-- RESUMEN EJECUTIVO
-- ========================================================================
-- Ejecutar este query para obtener un resumen de todos los problemas:

SELECT 
    'P-001: Cuotas duplicadas' AS problema,
    (SELECT COUNT(*) FROM (
        SELECT id_socio, periodo FROM cuota GROUP BY id_socio, periodo HAVING COUNT(*) > 1
    ) t) AS cantidad_registros_afectados,
    'CRÍTICO' AS severidad
UNION ALL
SELECT 
    'P-002: Inscripciones duplicadas' AS problema,
    (SELECT COUNT(*) FROM (
        SELECT id_socio, id_temporada FROM socio_temporada GROUP BY id_socio, id_temporada HAVING COUNT(*) > 1
    ) t) AS cantidad,
    'CRÍTICO' AS severidad
UNION ALL
SELECT 
    'P-005a: Líneas CUOTA sin id_cuota' AS problema,
    (SELECT COUNT(*) FROM cobro_operacion_linea WHERE tipo_linea = 'CUOTA' AND id_cuota IS NULL) AS cantidad,
    'CRÍTICO' AS severidad
UNION ALL
SELECT 
    'P-005b: Líneas CONCEPTO sin concepto' AS problema,
    (SELECT COUNT(*) FROM cobro_operacion_linea WHERE tipo_linea = 'CONCEPTO' AND (concepto IS NULL OR concepto = '')) AS cantidad,
    'CRÍTICO' AS severidad
UNION ALL
SELECT 
    'P-008: Socios con tarjeta sin número' AS problema,
    (SELECT COUNT(*) FROM socio WHERE tarjeta_centro = true AND (numero_tarjeta_centro IS NULL OR numero_tarjeta_centro = '')) AS cantidad,
    'MEDIO' AS severidad
UNION ALL
SELECT 
    'P-004: Operaciones con total inconsistente' AS problema,
    (SELECT COUNT(*) FROM (
        SELECT co.id_cobro_operacion
        FROM cobro_operacion co
        LEFT JOIN cobro_operacion_linea col ON col.id_cobro_operacion = co.id_cobro_operacion
        GROUP BY co.id_cobro_operacion, co.total
        HAVING co.total != COALESCE(SUM(col.monto), 0)
    ) t) AS cantidad,
    'ALTO' AS severidad;
