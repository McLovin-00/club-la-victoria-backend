-- Migración: Agregar campos nombre y apellido para no socios
-- Fecha: 2026-01-02
-- Descripción: Permite registrar nombre y apellido de personas no registradas como socios
-- 
-- INSTRUCCIONES:
-- 1. Ejecutar este script en la base de datos de producción ANTES de deployar el nuevo código
-- 2. Es retrocompatible: los registros existentes quedarán con NULL en estos campos
-- 3. El frontend muestra "-" cuando estos campos son NULL

ALTER TABLE registro_ingreso 
ADD COLUMN IF NOT EXISTS nombre_no_socio VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS apellido_no_socio VARCHAR(100) NULL;

-- Verificar que las columnas se crearon correctamente
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'registro_ingreso' 
-- AND COLUMN_NAME IN ('nombre_no_socio', 'apellido_no_socio');
