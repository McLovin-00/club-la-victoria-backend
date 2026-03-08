-- Migration: agregar marca de rechazo de Tarjeta del Centro por cuota
-- Fecha: 2026-03-04

ALTER TABLE cuota
ADD COLUMN rechazada_tarjeta_centro BOOLEAN NOT NULL DEFAULT false;
