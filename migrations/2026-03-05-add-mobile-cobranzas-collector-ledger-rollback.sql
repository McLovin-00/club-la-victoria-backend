# Rollback: mobile cobranzas - cobrador, operación de cobro, comisión y cuenta corriente
# Fecha: 2026-03-05

DROP TABLE IF EXISTS cobrador_cuenta_corriente_movimiento;
DROP TABLE IF EXISTS cobrador_comision_config;

DROP INDEX IF EXISTS idx_pago_cuota_cobrador;
DROP INDEX IF EXISTS idx_pago_cuota_operacion;

ALTER TABLE pago_cuota DROP CONSTRAINT IF EXISTS fk_pago_cuota_cobrador;
ALTER TABLE pago_cuota DROP CONSTRAINT IF EXISTS fk_pago_cuota_cobro_operacion;

ALTER TABLE pago_cuota DROP COLUMN IF EXISTS id_cobrador;
ALTER TABLE pago_cuota DROP COLUMN IF EXISTS id_cobro_operacion;

DROP TABLE IF EXISTS cobro_operacion_linea;
DROP TABLE IF EXISTS cobro_operacion;

DROP TABLE IF EXISTS cobrador_dispositivo;
DROP TABLE IF EXISTS cobrador;
