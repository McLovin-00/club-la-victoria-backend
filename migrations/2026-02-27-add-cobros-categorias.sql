-- Migración: Agregar módulo de cobros y categorías de socio
-- Fecha: 2026-02-27
-- Descripción: Crea tablas para gestión de cobros (categoria_socio, cuota, pago_cuota)
-- 
-- INSTRUCCIONES:
-- 1. Ejecutar este script en la base de datos ANTES de deployar el nuevo código
-- 2. Es retrocompatible: los registros existentes quedarán con NULL en los nuevos campos
-- 3. Se crea una categoría "General" por defecto para transición

-- =====================================================
-- 1. CREAR TABLA categoria_socio
-- =====================================================
CREATE TABLE IF NOT EXISTS categoria_socio (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    monto_mensual DECIMAL(10, 2) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Crear índice para búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_categoria_socio_nombre ON categoria_socio(nombre);

-- Insertar categoría "General" por defecto para transición de socios existentes
INSERT INTO categoria_socio (nombre, monto_mensual, activo)
VALUES ('General', 0.00, TRUE)
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- 2. AGREGAR FK DE CATEGORÍA EN TABLA socio
-- =====================================================
ALTER TABLE socio 
ADD COLUMN IF NOT EXISTS id_categoria INTEGER NULL;

ALTER TABLE socio 
ADD CONSTRAINT fk_socio_categoria 
FOREIGN KEY (id_categoria) REFERENCES categoria_socio(id_categoria) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Crear índice para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_socio_categoria ON socio(id_categoria);

-- =====================================================
-- 3. CREAR TABLA cuota
-- =====================================================
CREATE TABLE IF NOT EXISTS cuota (
    id_cuota SERIAL PRIMARY KEY,
    id_socio INTEGER NOT NULL,
    periodo VARCHAR(7) NOT NULL, -- Formato YYYY-MM
    monto DECIMAL(10, 2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADA')),
    barcode VARCHAR(50) UNIQUE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_pago TIMESTAMP NULL,
    
    CONSTRAINT fk_cuota_socio FOREIGN KEY (id_socio) 
        REFERENCES socio(id_socio) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Constraint de unicidad: un socio solo puede tener una cuota por periodo
    CONSTRAINT uk_cuota_socio_periodo UNIQUE (id_socio, periodo)
);

-- Crear índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_cuota_socio ON cuota(id_socio);
CREATE INDEX IF NOT EXISTS idx_cuota_periodo ON cuota(periodo);
CREATE INDEX IF NOT EXISTS idx_cuota_estado ON cuota(estado);
CREATE INDEX IF NOT EXISTS idx_cuota_barcode ON cuota(barcode);

-- =====================================================
-- 4. CREAR TABLA pago_cuota
-- =====================================================
CREATE TABLE IF NOT EXISTS pago_cuota (
    id_pago SERIAL PRIMARY KEY,
    id_cuota INTEGER NOT NULL,
    monto_pagado DECIMAL(10, 2) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'OTRO')),
    fecha_pago TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    observaciones VARCHAR(255) NULL,
    
    CONSTRAINT fk_pago_cuota FOREIGN KEY (id_cuota) 
        REFERENCES cuota(id_cuota) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Crear índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_pago_cuota ON pago_cuota(id_cuota);
CREATE INDEX IF NOT EXISTS idx_pago_fecha ON pago_cuota(fecha_pago);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que las tablas se crearon correctamente
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('categoria_socio', 'cuota', 'pago_cuota');

-- Verificar que la categoría General se creó
-- SELECT * FROM categoria_socio WHERE nombre = 'General';
