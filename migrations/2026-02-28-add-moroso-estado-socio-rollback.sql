-- Rollback: estado MOROSO en socio
-- Fecha: 2026-02-28
-- ADVERTENCIA:
-- PostgreSQL no permite eliminar fácilmente un valor de enum en caliente.
-- Este rollback revierte los datos MOROSO -> INACTIVO, pero no elimina
-- el valor MOROSO del tipo enum.

UPDATE socio
SET estado = 'INACTIVO'
WHERE estado = 'MOROSO';
