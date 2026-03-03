-- Migración: Rollback del módulo de cobros y categorías de socio
-- Fecha: 2026-02-27
-- Descripción: Elimina tablas para gestión de cobros (categoria_socio, cuota, pago_cuota)
-- 
-- ADVERTENCIA: Esta migración destruye datos. Usar solo si es necesario revertir.
-- Orden: Eliminar primero las tablas que tienen FKs hacia otras.

-- =====================================================
-- 1. ELIMINAR TABLA pago_cuota (tiene FK hacia cuota)
-- =====================================================
DROP TABLE IF EXISTS pago_cuota CASCADE;

-- =====================================================
-- 2. ELIMINAR TABLA cuota (tiene FK hacia socio)
-- =====================================================
DROP TABLE IF EXISTS cuota CASCADE;

-- =====================================================
-- 3. REMOVER FK DE CATEGORÍA EN TABLA socio
-- =====================================================
ALTER TABLE socio DROP CONSTRAINT IF EXISTS fk_socio_categoria;
ALTER TABLE socio DROP COLUMN IF EXISTS id_categoria;

-- =====================================================
-- 4. ELIMINAR TABLA categoria_socio
-- =====================================================
DROP TABLE IF EXISTS categoria_socio CASCADE;
