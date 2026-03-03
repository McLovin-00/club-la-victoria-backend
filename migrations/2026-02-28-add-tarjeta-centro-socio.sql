-- Migration: Agregar campos tarjetaCentro y numeroTarjetaCentro a entidad Socio
-- Fecha: 2026-02-28

-- Agregar columna tarjeta_centro a la tabla socio
ALTER TABLE socio ADD COLUMN tarjeta_centro BOOLEAN NOT NULL DEFAULT false;

-- Agregar columna numero_tarjeta_centro a la tabla socio
ALTER TABLE socio ADD COLUMN numero_tarjeta_centro VARCHAR(50) NULL;

-- Nota: numero_tarjeta_centro solo se usa cuando tarjeta_centro es true
