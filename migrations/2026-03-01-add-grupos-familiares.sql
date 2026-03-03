-- Migración: Agregar módulo de grupos familiares
-- Fecha: 2026-03-01
-- Descripción: Crea tabla grupo_familiar y agrega FK en socio para relación opcional
-- 
-- INSTRUCCIONES:
-- 1. Ejecutar este script en la base de datos ANTES de deployar el nuevo código
-- 2. Es retrocompatible: los socios existentes quedarán con NULL en el nuevo campo
-- 3. Los grupos familiares son opcionales, no afecta datos existentes

-- =====================================================
-- 1. CREAR TABLA grupo_familiar
-- =====================================================
CREATE TABLE IF NOT EXISTS grupo_familiar (
    id_grupo_familiar SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255) NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Crear índice para búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_grupo_familiar_nombre ON grupo_familiar(nombre);

-- Crear índice para ordenamiento
CREATE INDEX IF NOT EXISTS idx_grupo_familiar_orden ON grupo_familiar(orden);

-- =====================================================
-- 2. AGREGAR FK DE GRUPO FAMILIAR EN TABLA socio
-- =====================================================
ALTER TABLE socio 
ADD COLUMN IF NOT EXISTS id_grupo_familiar INTEGER NULL;

ALTER TABLE socio 
ADD CONSTRAINT fk_socio_grupo_familiar 
FOREIGN KEY (id_grupo_familiar) REFERENCES grupo_familiar(id_grupo_familiar) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Crear índice para búsquedas por grupo familiar
CREATE INDEX IF NOT EXISTS idx_socio_grupo_familiar ON socio(id_grupo_familiar);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que la tabla se creó correctamente
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grupo_familiar';

-- Verificar que la columna se agregó
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'socio' AND column_name = 'id_grupo_familiar';
