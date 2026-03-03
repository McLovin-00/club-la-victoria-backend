-- Rollback: Eliminar módulo de grupos familiares
-- Fecha: 2026-03-01
-- Descripción: Elimina FK y columna de socio, luego elimina tabla grupo_familiar
--
-- ADVERTENCIA: Este script elimina datos de grupos familiares
-- Los socios quedarán sin grupo asignado (id_grupo_familiar = NULL)

-- =====================================================
-- 1. ELIMINAR FK DE GRUPO FAMILIAR EN TABLA socio
-- =====================================================
ALTER TABLE socio DROP CONSTRAINT IF EXISTS fk_socio_grupo_familiar;

-- Eliminar índice
DROP INDEX IF EXISTS idx_socio_grupo_familiar;

-- Eliminar columna
ALTER TABLE socio DROP COLUMN IF EXISTS id_grupo_familiar;

-- =====================================================
-- 2. ELIMINAR TABLA grupo_familiar
-- =====================================================
DROP TABLE IF EXISTS grupo_familiar CASCADE;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que la columna se eliminó
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'socio' AND column_name = 'id_grupo_familiar';

-- Verificar que la tabla se eliminó
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grupo_familiar';
