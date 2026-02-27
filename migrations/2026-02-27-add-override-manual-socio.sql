-- Migration: Agregar campo overrideManual a entidad Socio
-- Fecha: 2026-02-27

-- Agregar columna override_manual a la tabla socio
ALTER TABLE socio ADD COLUMN override_manual BOOLEAN NOT NULL DEFAULT false;

-- La columna se deja NULL en la entidad TypeORM pero MySQL requiere valor por defecto
-- El valor 0 representa false
