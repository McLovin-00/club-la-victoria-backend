-- Rollback: quitar marca de rechazo de Tarjeta del Centro por cuota
-- Fecha: 2026-03-04

ALTER TABLE cuota
DROP COLUMN rechazada_tarjeta_centro;
