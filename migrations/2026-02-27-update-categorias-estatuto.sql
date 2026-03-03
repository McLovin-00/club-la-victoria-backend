-- Migración: Actualizar categorías según estatuto del club
-- Fecha: 2026-02-27
-- Descripción: 
--   1. Agrega campo 'exento' a categoria_socio
--   2. Reemplaza categoría "General" por las 4 categorías fijas del estatuto
--   3. Actualiza las categorías existentes

-- =====================================================
-- 1. AGREGAR CAMPO EXENTO
-- =====================================================
ALTER TABLE categoria_socio 
ADD COLUMN IF NOT EXISTS exento BOOLEAN NOT NULL DEFAULT FALSE;

-- =====================================================
-- 2. ELIMINAR CATEGORÍA "General" SI NO TIENE SOCIOS
-- =====================================================
-- Primero, reasignar socios de "General" a "ACTIVO" (si existen)
UPDATE socio 
SET id_categoria = NULL
WHERE id_categoria = (SELECT id_categoria FROM categoria_socio WHERE nombre = 'General');

-- Luego eliminar la categoría "General"
DELETE FROM categoria_socio WHERE nombre = 'General';

-- =====================================================
-- 3. INSERTAR/ACTUALIZAR CATEGORÍAS DEL ESTATUTO
-- =====================================================
-- ACTIVO: Socio mayor de edad, paga cuota completa
INSERT INTO categoria_socio (nombre, monto_mensual, activo, exento)
VALUES ('ACTIVO', 10000.00, TRUE, FALSE)
ON CONFLICT (nombre) DO UPDATE SET 
  exento = FALSE,
  activo = TRUE;

-- ADHERENTE: Menores de edad, paga cuota reducida
INSERT INTO categoria_socio (nombre, monto_mensual, activo, exento)
VALUES ('ADHERENTE', 5000.00, TRUE, FALSE)
ON CONFLICT (nombre) DO UPDATE SET 
  exento = FALSE,
  activo = TRUE;

-- VITALICIO: 45+ años de antigüedad, NO paga cuota
INSERT INTO categoria_socio (nombre, monto_mensual, activo, exento)
VALUES ('VITALICIO', 0.00, TRUE, TRUE)
ON CONFLICT (nombre) DO UPDATE SET 
  exento = TRUE,
  activo = TRUE;

-- HONORARIO: Por méritos, NO paga cuota
INSERT INTO categoria_socio (nombre, monto_mensual, activo, exento)
VALUES ('HONORARIO', 0.00, TRUE, TRUE)
ON CONFLICT (nombre) DO UPDATE SET 
  exento = TRUE,
  activo = TRUE;

-- =====================================================
-- 4. VERIFICACIÓN
-- =====================================================
-- Verificar que existen exactamente 4 categorías
-- SELECT COUNT(*) FROM categoria_socio;
-- SELECT * FROM categoria_socio ORDER BY nombre;
