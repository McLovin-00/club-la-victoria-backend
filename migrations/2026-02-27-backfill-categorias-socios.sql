-- ================================================================================
-- MIGRACIÓN DE BACKFILL DE CATEGORÍAS PARA SOCIOS EXISTENTES
-- ================================================================================
-- FECHA: 2026-02-27
-- PROPÓSITO: Asignar categoría automáticamente a socios con id_categoria IS NULL
-- LÓGICA: Basada en el motor de reglas del sistema (categoria-rules.service.ts)
-- ================================================================================
-- Reglas del estatuto:
--   - Si fechaNacimiento indica < 18 años → ADHERENTE
--   - Si fechaNacimiento indica >= 18 años → ACTIVO
--   - Si fechaAlta indica >= 45 años de antigüedad → VITALICIO
-- ================================================================================

-- ================================================================================
-- 1. CONSULTAR Y REPORTAR SOCIOS CON DATOS INVÁLIDOS
-- ================================================================================

SELECT
    s.id_socio,
    s.nombre,
    s.apellido,
    s.dni,
    s.fecha_alta,
    s.fecha_nacimiento,
    s.id_categoria,
    'ERROR: fecha_nacimiento es NULL' as error
FROM socio s
WHERE s.fecha_nacimiento IS NULL

UNION ALL

SELECT
    s.id_socio,
    s.nombre,
    s.apellido,
    s.dni,
    s.fecha_alta,
    s.fecha_nacimiento,
    s.id_categoria,
    'ERROR: fecha_alta es NULL' as error
FROM socio s
WHERE s.fecha_alta IS NULL

ORDER BY id_socio;

-- ================================================================================
-- 2. REPORTAR SOCIOS CON CATEGORÍA YA ASIGNADA (Para verificar que NO se modifican)
-- ================================================================================

SELECT
    s.id_socio,
    s.nombre,
    s.apellido,
    s.dni,
    s.fecha_alta,
    s.fecha_nacimiento,
    cat.nombre as categoria_actual,
    cat.monto_mensual
FROM socio s
INNER JOIN categoria_socio cat ON s.id_categoria = cat.id_categoria
WHERE s.id_categoria IS NOT NULL
ORDER BY s.id_socio;

-- ================================================================================
-- 3. REPORTAR SOCIOS CON CATEGORÍA NULL (Que necesitan ser actualizados)
-- ================================================================================

SELECT
    s.id_socio,
    s.nombre,
    s.apellido,
    s.dni,
    s.fecha_alta,
    s.fecha_nacimiento,
    s.estado,
    s.genero,
    'PENDIENTE: Asignar categoría automáticamente' as accion_recomendada
FROM socio s
WHERE s.id_categoria IS NULL
ORDER BY s.id_socio;

-- ================================================================================
-- 4. ASIGNAR CATEGORÍAS A SOCIOS (Con fecha_nacimiento y fecha_alta válidas)
-- ================================================================================
-- NOTA: Esta consulta solo afecta socios con id_categoria IS NULL
-- La lógica de asignación:
--   - Si categoria.nombre = 'HONORARIO' → HONORARIO (solo se mantiene)
--   - Si calcularAniosCumplidos(fecha_alta, '2026-02-27') >= 45 → VITALICIO
--   - Si calcularAniosCumplidos(fecha_nacimiento, '2026-02-27') < 18 → ADHERENTE
--   - Si calcularAniosCumplidos(fecha_nacimiento, '2026-02-27') >= 18 → ACTIVO

-- Primero, obtener los IDs de las categorías
SELECT
    id_categoria,
    nombre,
    monto_mensual
FROM categoria_socio
WHERE nombre IN ('ACTIVO', 'ADHERENTE', 'VITALICIO', 'HONORARIO')
ORDER BY nombre;

-- ================================================================================
-- CÁLCULO DE AÑOS CUMPLIDOS (entre dos fechas YYYY-MM-DD)
-- Si (mes_fin < mes_inicio) O (mes_fin = mes_inicio Y dia_fin < dia_inicio) → anios - 1
-- Sino → anios
-- ================================================================================

-- Cálculo de antigüedad >= 45 años (fecha_alta)
WITH categoria_ids AS (
    SELECT
        id_categoria,
        nombre
    FROM categoria_socio
    WHERE nombre IN ('ACTIVO', 'ADHERENTE', 'VITALICIO', 'HONORARIO')
),
categorias_vitalicio AS (
    -- Categoría VITALICIO: 45+ años de antigüedad
    SELECT
        s.id_socio,
        (SELECT id_categoria FROM categoria_socio WHERE nombre = 'VITALICIO') as id_categoria_vitalicio
    FROM socio s
    WHERE s.id_categoria IS NULL
      AND s.fecha_alta IS NOT NULL
      -- Calcular si tiene 45+ años (hoy: 2026-02-27)
      AND (
          -- Calcular anios_cumplidos entre fecha_alta y 2026-02-27
          (EXTRACT(YEAR FROM '2026-02-27'::date) - EXTRACT(YEAR FROM s.fecha_alta)) -
          CASE
              WHEN EXTRACT(MONTH FROM '2026-02-27'::date) < EXTRACT(MONTH FROM s.fecha_alta)
                  OR (EXTRACT(MONTH FROM '2026-02-27'::date) = EXTRACT(MONTH FROM s.fecha_alta)
                      AND EXTRACT(DAY FROM '2026-02-27'::date) < EXTRACT(DAY FROM s.fecha_alta))
              THEN 1
              ELSE 0
          END
      ) >= 45
      AND s.fecha_nacimiento IS NOT NULL  -- Validación de datos
)
UPDATE socio s
SET id_categoria = cv.id_categoria_vitalicio
FROM categorias_vitalicio cv
WHERE s.id_socio = cv.id_socio
  AND s.id_categoria IS NULL;

-- Cálculo de edad < 18 años (fecha_nacimiento)
WITH categoria_ids AS (
    SELECT
        id_categoria,
        nombre
    FROM categoria_socio
    WHERE nombre IN ('ACTIVO', 'ADHERENTE', 'VITALICIO', 'HONORARIO')
),
categorias_adherente AS (
    -- Categoría ADHERENTE: Menores de 18 años
    SELECT
        s.id_socio,
        (SELECT id_categoria FROM categoria_socio WHERE nombre = 'ADHERENTE') as id_categoria_adherente
    FROM socio s
    WHERE s.id_categoria IS NULL
      AND s.fecha_nacimiento IS NOT NULL
      -- Calcular si es menor de 18 años (hoy: 2026-02-27)
      AND (
          -- Calcular anios_cumplidos entre fecha_nacimiento y 2026-02-27
          (EXTRACT(YEAR FROM '2026-02-27'::date) - EXTRACT(YEAR FROM s.fecha_nacimiento)) -
          CASE
              WHEN EXTRACT(MONTH FROM '2026-02-27'::date) < EXTRACT(MONTH FROM s.fecha_nacimiento)
                  OR (EXTRACT(MONTH FROM '2026-02-27'::date) = EXTRACT(MONTH FROM s.fecha_nacimiento)
                      AND EXTRACT(DAY FROM '2026-02-27'::date) < EXTRACT(DAY FROM s.fecha_nacimiento))
              THEN 1
              ELSE 0
          END
      ) < 18
)
UPDATE socio s
SET id_categoria = ca.id_categoria_adherente
FROM categorias_adherente ca
WHERE s.id_socio = ca.id_socio
  AND s.id_categoria IS NULL;

-- Cálculo de edad >= 18 años (fecha_nacimiento)
WITH categoria_ids AS (
    SELECT
        id_categoria,
        nombre
    FROM categoria_socio
    WHERE nombre IN ('ACTIVO', 'ADHERENTE', 'VITALICIO', 'HONORARIO')
),
categorias_activo AS (
    -- Categoría ACTIVO: Mayor de 18 años (por defecto si no es VITALICIO ni ADHERENTE)
    SELECT
        s.id_socio,
        (SELECT id_categoria FROM categoria_socio WHERE nombre = 'ACTIVO') as id_categoria_activo
    FROM socio s
    WHERE s.id_categoria IS NULL
      AND s.fecha_nacimiento IS NOT NULL
      -- Calcular si es mayor de 18 años (hoy: 2026-02-27)
      AND (
          -- Calcular anios_cumplidos entre fecha_nacimiento y 2026-02-27
          (EXTRACT(YEAR FROM '2026-02-27'::date) - EXTRACT(YEAR FROM s.fecha_nacimiento)) -
          CASE
              WHEN EXTRACT(MONTH FROM '2026-02-27'::date) < EXTRACT(MONTH FROM s.fecha_nacimiento)
                  OR (EXTRACT(MONTH FROM '2026-02-27'::date) = EXTRACT(MONTH FROM s.fecha_nacimiento)
                      AND EXTRACT(DAY FROM '2026-02-27'::date) < EXTRACT(DAY FROM s.fecha_nacimiento))
              THEN 1
              ELSE 0
          END
      ) >= 18
)
UPDATE socio s
SET id_categoria = ca.id_categoria_activo
FROM categorias_activo ca
WHERE s.id_socio = ca.id_socio
  AND s.id_categoria IS NULL;

-- ================================================================================
-- 5. VERIFICACIÓN FINAL (Reportar socios actualizados)
-- ================================================================================

SELECT
    s.id_socio,
    s.nombre,
    s.apellido,
    s.dni,
    s.fecha_alta,
    s.fecha_nacimiento,
    s.id_categoria,
    cat.nombre as categoria_asignada,
    cat.monto_mensual
FROM socio s
INNER JOIN categoria_socio cat ON s.id_categoria = cat.id_categoria
WHERE s.id_categoria IS NOT NULL
  AND s.fecha_nacimiento IS NOT NULL
  AND s.fecha_alta IS NOT NULL
ORDER BY s.id_socio;

-- ================================================================================
-- 6. RESUMEN DE LA MIGRACIÓN
-- ================================================================================

SELECT
    COUNT(*) as total_socios_con_categoria_asignada,
    SUM(CASE WHEN cat.nombre = 'VITALICIO' THEN 1 ELSE 0 END) as total_vitalicios,
    SUM(CASE WHEN cat.nombre = 'ACTIVO' THEN 1 ELSE 0 END) as total_activos,
    SUM(CASE WHEN cat.nombre = 'ADHERENTE' THEN 1 ELSE 0 END) as total_adherentes,
    SUM(CASE WHEN cat.nombre = 'HONORARIO' THEN 1 ELSE 0 END) as total_honorarios
FROM socio s
INNER JOIN categoria_socio cat ON s.id_categoria = cat.id_categoria
WHERE s.fecha_nacimiento IS NOT NULL
  AND s.fecha_alta IS NOT NULL;

-- ================================================================================
-- 7. SOCIOS QUE NO PUDIERON SER ASIGNADOS (Datos inválidos)
-- ================================================================================

SELECT
    s.id_socio,
    s.nombre,
    s.apellido,
    s.dni,
    s.fecha_alta,
    s.fecha_nacimiento,
    s.id_categoria,
    cat.nombre as categoria_actual,
    cat.monto_mensual,
    CASE
        WHEN s.fecha_nacimiento IS NULL THEN 'ERROR: fecha_nacimiento es NULL'
        WHEN s.fecha_alta IS NULL THEN 'ERROR: fecha_alta es NULL'
        ELSE 'ERROR: categoría aún NULL (posible inconsistencia)'
    END as error
FROM socio s
LEFT JOIN categoria_socio cat ON s.id_categoria = cat.id_categoria
WHERE s.fecha_nacimiento IS NULL
   OR s.fecha_alta IS NULL
ORDER BY s.id_socio;
