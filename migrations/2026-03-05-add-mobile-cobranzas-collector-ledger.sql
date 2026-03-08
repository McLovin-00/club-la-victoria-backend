# Migration: mobile cobranzas - cobrador, operación de cobro, comisión y cuenta corriente
# Fecha: 2026-03-05

-- ========================================================================
-- 1) COBRADORES Y VINCULACIÓN DE DISPOSITIVO
-- ========================================================================

CREATE TABLE IF NOT EXISTS cobrador (
  id_cobrador SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cobrador_dispositivo (
  id_cobrador_dispositivo SERIAL PRIMARY KEY,
  id_cobrador INTEGER NOT NULL REFERENCES cobrador(id_cobrador) ON DELETE RESTRICT ON UPDATE CASCADE,
  installation_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_cobrador_dispositivo_installation UNIQUE (installation_id)
);

CREATE INDEX IF NOT EXISTS idx_cobrador_dispositivo_cobrador
  ON cobrador_dispositivo(id_cobrador);

-- ========================================================================
-- 2) OPERACIÓN DE COBRO (HEADER + LÍNEAS)
-- ========================================================================

CREATE TABLE IF NOT EXISTS cobro_operacion (
  id_cobro_operacion SERIAL PRIMARY KEY,
  id_socio INTEGER NOT NULL REFERENCES socio(id_socio) ON DELETE RESTRICT ON UPDATE CASCADE,
  id_metodo_pago INTEGER NOT NULL REFERENCES metodos_pago(id_metodo_pago) ON DELETE RESTRICT ON UPDATE CASCADE,
  actor_cobro VARCHAR(20) NOT NULL,
  origen_cobro VARCHAR(20) NOT NULL,
  id_cobrador INTEGER NULL REFERENCES cobrador(id_cobrador) ON DELETE RESTRICT ON UPDATE CASCADE,
  idempotency_key VARCHAR(128) NULL,
  total NUMERIC(12,2) NOT NULL,
  referencia VARCHAR(255) NULL,
  observaciones VARCHAR(255) NULL,
  fecha_hora_servidor TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT chk_cobro_operacion_actor CHECK (actor_cobro IN ('COBRADOR', 'OPERADOR')),
  CONSTRAINT chk_cobro_operacion_origen CHECK (origen_cobro IN ('MOBILE', 'WEB'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cobro_operacion_idempotency
  ON cobro_operacion(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cobro_operacion_socio ON cobro_operacion(id_socio);
CREATE INDEX IF NOT EXISTS idx_cobro_operacion_cobrador ON cobro_operacion(id_cobrador);
CREATE INDEX IF NOT EXISTS idx_cobro_operacion_fecha ON cobro_operacion(fecha_hora_servidor);

CREATE TABLE IF NOT EXISTS cobro_operacion_linea (
  id_cobro_operacion_linea SERIAL PRIMARY KEY,
  id_cobro_operacion INTEGER NOT NULL REFERENCES cobro_operacion(id_cobro_operacion) ON DELETE CASCADE ON UPDATE CASCADE,
  tipo_linea VARCHAR(20) NOT NULL,
  id_cuota INTEGER NULL REFERENCES cuota(id_cuota) ON DELETE RESTRICT ON UPDATE CASCADE,
  concepto VARCHAR(80) NULL,
  descripcion VARCHAR(255) NULL,
  monto NUMERIC(12,2) NOT NULL,
  CONSTRAINT chk_cobro_operacion_linea_tipo CHECK (tipo_linea IN ('CUOTA', 'CONCEPTO'))
);

CREATE INDEX IF NOT EXISTS idx_cobro_operacion_linea_operacion
  ON cobro_operacion_linea(id_cobro_operacion);

CREATE INDEX IF NOT EXISTS idx_cobro_operacion_linea_cuota
  ON cobro_operacion_linea(id_cuota);

-- ========================================================================
-- 3) VINCULACIÓN OPCIONAL DE PAGO_CUOTA CON OPERACIÓN/COBRADOR
-- ========================================================================

ALTER TABLE pago_cuota
  ADD COLUMN IF NOT EXISTS id_cobro_operacion INTEGER NULL;

ALTER TABLE pago_cuota
  ADD COLUMN IF NOT EXISTS id_cobrador INTEGER NULL;

ALTER TABLE pago_cuota
  DROP CONSTRAINT IF EXISTS fk_pago_cuota_cobro_operacion;

ALTER TABLE pago_cuota
  ADD CONSTRAINT fk_pago_cuota_cobro_operacion
  FOREIGN KEY (id_cobro_operacion)
  REFERENCES cobro_operacion(id_cobro_operacion)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE pago_cuota
  DROP CONSTRAINT IF EXISTS fk_pago_cuota_cobrador;

ALTER TABLE pago_cuota
  ADD CONSTRAINT fk_pago_cuota_cobrador
  FOREIGN KEY (id_cobrador)
  REFERENCES cobrador(id_cobrador)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pago_cuota_operacion
  ON pago_cuota(id_cobro_operacion);

CREATE INDEX IF NOT EXISTS idx_pago_cuota_cobrador
  ON pago_cuota(id_cobrador);

-- ========================================================================
-- 4) CONFIGURACIÓN DE COMISIÓN Y CUENTA CORRIENTE DEL COBRADOR
-- ========================================================================

CREATE TABLE IF NOT EXISTS cobrador_comision_config (
  id_cobrador_comision_config SERIAL PRIMARY KEY,
  id_cobrador INTEGER NOT NULL REFERENCES cobrador(id_cobrador) ON DELETE RESTRICT ON UPDATE CASCADE,
  porcentaje NUMERIC(7,4) NOT NULL,
  vigente_desde TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobrador_comision_vigencia
  ON cobrador_comision_config(id_cobrador, vigente_desde);

CREATE TABLE IF NOT EXISTS cobrador_cuenta_corriente_movimiento (
  id_cobrador_movimiento SERIAL PRIMARY KEY,
  id_cobrador INTEGER NOT NULL REFERENCES cobrador(id_cobrador) ON DELETE RESTRICT ON UPDATE CASCADE,
  tipo_movimiento VARCHAR(40) NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  id_cobro_operacion INTEGER NULL REFERENCES cobro_operacion(id_cobro_operacion) ON DELETE SET NULL ON UPDATE CASCADE,
  usuario_registra VARCHAR(120) NULL,
  observacion VARCHAR(255) NULL,
  referencia VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT chk_movimiento_tipo CHECK (tipo_movimiento IN ('COMISION_GENERADA', 'PAGO_A_COBRADOR', 'AJUSTE'))
);

CREATE INDEX IF NOT EXISTS idx_cobrador_mov_fecha
  ON cobrador_cuenta_corriente_movimiento(id_cobrador, created_at);
