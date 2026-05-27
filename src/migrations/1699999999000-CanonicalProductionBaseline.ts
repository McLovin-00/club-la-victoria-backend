import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalProductionBaseline1699999999000
  implements MigrationInterface
{
  name = 'CanonicalProductionBaseline1699999999000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableCount = await this.getPublicTableCount(queryRunner);

    if (tableCount === 0) {
      await this.createCanonicalSchema(queryRunner);
      return;
    }

    if (await this.schemaLooksCanonical(queryRunner)) {
      return;
    }

    throw new Error(
      'Refusing to run canonical baseline: non-empty database does not match the canonical production baseline. Reset local DB or repair schema before running migrations.',
    );
  }

  public async down(): Promise<void> {
    // Baseline migration for fresh databases. Never auto-drop production data.
  }

  private async getPublicTableCount(queryRunner: QueryRunner): Promise<number> {
    const [result] = await queryRunner.query(`
      SELECT COUNT(*)::int AS table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> 'migrations'
    `);

    return Number(result?.table_count ?? 0);
  }

  private async schemaLooksCanonical(queryRunner: QueryRunner): Promise<boolean> {
    const [result] = await queryRunner.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'socio'
        ) AS has_socio,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'categoria_socio' AND column_name = 'id_categoria'
        ) AS has_categoria_socio,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'cuota' AND column_name = 'periodo'
        ) AS has_cuota_periodo,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'cuota' AND column_name = 'id_socio'
        ) AS has_cuota_socio,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'grupo_familiar' AND column_name = 'nombre'
        ) AS has_grupo_nombre,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'pago_cuota' AND column_name = 'metodo_pago'
        ) AS has_pago_metodo_pago,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'cobro_operacion'
        ) AS has_cobro_operacion
    `);

    return Boolean(
      result?.has_socio &&
        result?.has_categoria_socio &&
        result?.has_cuota_periodo &&
        result?.has_cuota_socio &&
        result?.has_grupo_nombre &&
        result?.has_pago_metodo_pago &&
        result?.has_cobro_operacion,
    );
  }

  private async createCanonicalSchema(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'actor_cobro') THEN
          CREATE TYPE public.actor_cobro AS ENUM ('COBRADOR', 'OPERADOR');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_socio') THEN
          CREATE TYPE public.estado_socio AS ENUM ('ACTIVO', 'INACTIVO', 'MOROSO');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'genero_socio') THEN
          CREATE TYPE public.genero_socio AS ENUM ('MASCULINO', 'FEMENINO');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metodo_pago') THEN
          CREATE TYPE public.metodo_pago AS ENUM ('EFECTIVO', 'TRANSFERENCIA');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'origen_cobro') THEN
          CREATE TYPE public.origen_cobro AS ENUM ('MOBILE', 'WEB');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_ingreso') THEN
          CREATE TYPE public.tipo_ingreso AS ENUM ('SOCIO_CLUB', 'SOCIO_PILETA', 'NO_SOCIO');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_linea_cobro') THEN
          CREATE TYPE public.tipo_linea_cobro AS ENUM ('CUOTA', 'CONCEPTO');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_movimiento_cobrador') THEN
          CREATE TYPE public.tipo_movimiento_cobrador AS ENUM ('COMISION_GENERADA', 'PAGO_A_COBRADOR', 'AJUSTE');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_notificacion') THEN
          CREATE TYPE public.tipo_notificacion AS ENUM ('MOROSIDAD_3_MESES', 'INHABILITACION_AUTOMATICA');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.set_fecha_hora_ingreso_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        NEW.fecha_hora_ingreso := NOW();
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.sync_pago_cuota_metodo_pago()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.id_metodo_pago IS NOT NULL
          AND (NEW.metodo_pago IS NULL OR btrim(NEW.metodo_pago) = '')
        THEN
          SELECT nombre INTO NEW.metodo_pago
          FROM metodos_pago
          WHERE id_metodo_pago = NEW.id_metodo_pago;
        END IF;

        IF NEW.id_metodo_pago IS NULL
          AND NEW.metodo_pago IS NOT NULL
        THEN
          SELECT id_metodo_pago INTO NEW.id_metodo_pago
          FROM metodos_pago
          WHERE upper(btrim(nombre)) = upper(btrim(NEW.metodo_pago))
          ORDER BY id_metodo_pago
          LIMIT 1;
        END IF;

        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE TABLE public.categoria_socio (
        id_categoria SERIAL PRIMARY KEY,
        nombre character varying(100) NOT NULL UNIQUE,
        monto_mensual numeric(10,2) NOT NULL,
        activo boolean NOT NULL DEFAULT true,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now(),
        exento boolean NOT NULL DEFAULT false
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.cobrador (
        id_cobrador SERIAL PRIMARY KEY,
        nombre character varying(255) NOT NULL UNIQUE,
        activo boolean DEFAULT true,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.grupo_familiar (
        id_grupo_familiar SERIAL PRIMARY KEY,
        nombre character varying(100) NOT NULL UNIQUE,
        descripcion character varying(255),
        orden integer NOT NULL DEFAULT 0,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.metodos_pago (
        id_metodo_pago SERIAL PRIMARY KEY,
        nombre character varying(50) NOT NULL UNIQUE,
        descripcion text,
        activo boolean NOT NULL DEFAULT true,
        orden integer NOT NULL DEFAULT 0,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        updated_at timestamp without time zone NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.temporada_pileta (
        id_temporada integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        nombre character varying(100) NOT NULL,
        fecha_inicio date NOT NULL,
        fecha_fin date NOT NULL,
        descripcion text,
        created_at timestamp with time zone DEFAULT now(),
        CONSTRAINT chk_fechas_temporada CHECK (fecha_fin > fecha_inicio)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.usuario (
        id_usuario integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        usuario character varying(100) NOT NULL UNIQUE,
        password character varying(100) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.socio (
        id_socio integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        nombre character varying(100) NOT NULL,
        apellido character varying(100) NOT NULL,
        dni character varying(20),
        telefono character varying(20),
        email character varying(150),
        fecha_alta date NOT NULL DEFAULT CURRENT_DATE,
        fecha_nacimiento date NOT NULL,
        direccion character varying(255),
        estado public.estado_socio DEFAULT 'ACTIVO'::public.estado_socio,
        genero public.genero_socio,
        foto_url character varying(500),
        id_categoria integer,
        override_manual boolean NOT NULL DEFAULT false,
        tarjeta_centro boolean NOT NULL DEFAULT false,
        numero_tarjeta_centro character varying(50),
        id_grupo_familiar integer,
        CONSTRAINT fk_socio_categoria FOREIGN KEY (id_categoria)
          REFERENCES public.categoria_socio(id_categoria) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_socio_grupo_familiar FOREIGN KEY (id_grupo_familiar)
          REFERENCES public.grupo_familiar(id_grupo_familiar) ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.socio_temporada (
        id_socio_temporada integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        id_socio integer NOT NULL,
        id_temporada integer NOT NULL,
        fecha_hora_inscripcion timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT fk_socio_temporada_socio FOREIGN KEY (id_socio)
          REFERENCES public.socio(id_socio) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_socio_temporada_temporada FOREIGN KEY (id_temporada)
          REFERENCES public.temporada_pileta(id_temporada) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.registro_ingreso (
        id_ingreso integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        id_socio integer,
        dni_no_socio character varying(20),
        tipo_ingreso public.tipo_ingreso NOT NULL,
        habilita_pileta boolean NOT NULL,
        metodo_pago public.metodo_pago,
        importe integer,
        fecha_hora_ingreso timestamp with time zone NOT NULL DEFAULT now(),
        nombre_no_socio character varying(100),
        apellido_no_socio character varying(100),
        CONSTRAINT registro_ingreso_id_socio_fkey FOREIGN KEY (id_socio)
          REFERENCES public.socio(id_socio) ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.notificacion (
        id_notificacion SERIAL PRIMARY KEY,
        tipo public.tipo_notificacion NOT NULL,
        socio_id integer NOT NULL,
        mensaje character varying(255) NOT NULL,
        leida boolean NOT NULL DEFAULT false,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        CONSTRAINT notificacion_socio_id_fkey FOREIGN KEY (socio_id)
          REFERENCES public.socio(id_socio) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.cuota (
        id_cuota SERIAL PRIMARY KEY,
        id_socio integer NOT NULL,
        periodo character varying(7) NOT NULL,
        monto numeric(10,2) NOT NULL,
        estado character varying(20) NOT NULL DEFAULT 'PENDIENTE'::character varying,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        fecha_pago timestamp without time zone,
        fecha_rechazo_tarjeta_centro timestamp without time zone,
        rechazada_tarjeta_centro boolean NOT NULL DEFAULT false,
        CONSTRAINT cuota_estado_check CHECK ((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PAGADA'::character varying])::text[])),
        CONSTRAINT fk_cuota_socio FOREIGN KEY (id_socio)
          REFERENCES public.socio(id_socio) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT uk_cuota_socio_periodo UNIQUE (id_socio, periodo)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.cobro_operacion (
        id_cobro_operacion SERIAL PRIMARY KEY,
        id_socio integer NOT NULL,
        id_metodo_pago integer NOT NULL,
        actor_cobro public.actor_cobro NOT NULL,
        origen_cobro public.origen_cobro NOT NULL,
        id_cobrador integer,
        idempotency_key character varying(128),
        total numeric(12,2) NOT NULL,
        referencia character varying(255),
        observaciones character varying(255),
        fecha_hora_servidor timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_cobro_operacion_socio FOREIGN KEY (id_socio)
          REFERENCES public.socio(id_socio),
        CONSTRAINT fk_cobro_operacion_metodo_pago FOREIGN KEY (id_metodo_pago)
          REFERENCES public.metodos_pago(id_metodo_pago),
        CONSTRAINT fk_cobro_operacion_cobrador FOREIGN KEY (id_cobrador)
          REFERENCES public.cobrador(id_cobrador)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.cobro_operacion_linea (
        id_cobro_operacion_linea SERIAL PRIMARY KEY,
        id_cobro_operacion integer NOT NULL,
        tipo_linea public.tipo_linea_cobro NOT NULL,
        id_cuota integer,
        concepto character varying(80),
        descripcion character varying(255),
        monto numeric(12,2) NOT NULL,
        CONSTRAINT fk_cobro_operacion_linea_operacion FOREIGN KEY (id_cobro_operacion)
          REFERENCES public.cobro_operacion(id_cobro_operacion) ON DELETE CASCADE,
        CONSTRAINT fk_cobro_operacion_linea_cuota FOREIGN KEY (id_cuota)
          REFERENCES public.cuota(id_cuota)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.pago_cuota (
        id_pago SERIAL PRIMARY KEY,
        id_cuota integer NOT NULL,
        monto_pagado numeric(10,2) NOT NULL,
        metodo_pago character varying(20) NOT NULL,
        fecha_pago timestamp without time zone NOT NULL DEFAULT now(),
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        observaciones character varying(255),
        fecha_emision_cuota timestamp without time zone,
        id_metodo_pago integer,
        id_cobro_operacion integer,
        id_cobrador integer,
        CONSTRAINT pago_cuota_metodo_pago_check CHECK ((metodo_pago)::text = ANY ((ARRAY['EFECTIVO'::character varying, 'TRANSFERENCIA'::character varying, 'TARJETA_DEBITO'::character varying, 'TARJETA_CREDITO'::character varying, 'OTRO'::character varying])::text[])),
        CONSTRAINT fk_pago_cuota FOREIGN KEY (id_cuota)
          REFERENCES public.cuota(id_cuota) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT pago_cuota_id_metodo_pago_fkey FOREIGN KEY (id_metodo_pago)
          REFERENCES public.metodos_pago(id_metodo_pago) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_pago_cuota_operacion FOREIGN KEY (id_cobro_operacion)
          REFERENCES public.cobro_operacion(id_cobro_operacion),
        CONSTRAINT fk_pago_cuota_cobrador FOREIGN KEY (id_cobrador)
          REFERENCES public.cobrador(id_cobrador)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.cobrador_dispositivo (
        id_cobrador_dispositivo SERIAL PRIMARY KEY,
        id_cobrador integer NOT NULL,
        installation_id character varying(128) NOT NULL,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        CONSTRAINT fk_cobrador_dispositivo_cobrador FOREIGN KEY (id_cobrador)
          REFERENCES public.cobrador(id_cobrador) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.cobrador_comision_config (
        id_cobrador_comision_config SERIAL PRIMARY KEY,
        id_cobrador integer NOT NULL,
        porcentaje numeric(7,4) NOT NULL,
        vigente_desde timestamp with time zone NOT NULL,
        created_at timestamp with time zone DEFAULT now(),
        CONSTRAINT cobrador_comision_config_id_cobrador_fkey FOREIGN KEY (id_cobrador)
          REFERENCES public.cobrador(id_cobrador)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE public.cobrador_cuenta_corriente_movimiento (
        id_cobrador_movimiento SERIAL PRIMARY KEY,
        id_cobrador integer NOT NULL,
        tipo_movimiento public.tipo_movimiento_cobrador NOT NULL,
        monto numeric(12,2) NOT NULL,
        id_cobro_operacion integer,
        usuario_registra character varying(120),
        observacion character varying(255),
        referencia character varying(255),
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_cobrador_mov_cobrador FOREIGN KEY (id_cobrador)
          REFERENCES public.cobrador(id_cobrador),
        CONSTRAINT fk_cobrador_mov_operacion FOREIGN KEY (id_cobro_operacion)
          REFERENCES public.cobro_operacion(id_cobro_operacion)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_categoria_socio_nombre ON public.categoria_socio (nombre)`);
    await queryRunner.query(`CREATE INDEX idx_cobrador_comision_vigencia ON public.cobrador_comision_config (id_cobrador, vigente_desde)`);
    await queryRunner.query(`CREATE INDEX idx_cobrador_mov_fecha ON public.cobrador_cuenta_corriente_movimiento (id_cobrador, created_at)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_cobrador_dispositivo_installation ON public.cobrador_dispositivo (installation_id)`);
    await queryRunner.query(`CREATE INDEX idx_cobro_operacion_socio ON public.cobro_operacion (id_socio)`);
    await queryRunner.query(`CREATE INDEX idx_cobro_operacion_cobrador ON public.cobro_operacion (id_cobrador)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_cobro_operacion_idempotency ON public.cobro_operacion (idempotency_key)`);
    await queryRunner.query(`CREATE INDEX idx_cobro_operacion_linea_operacion ON public.cobro_operacion_linea (id_cobro_operacion)`);
    await queryRunner.query(`CREATE INDEX idx_cuota_socio ON public.cuota (id_socio)`);
    await queryRunner.query(`CREATE INDEX idx_cuota_periodo ON public.cuota (periodo)`);
    await queryRunner.query(`CREATE INDEX idx_cuota_estado ON public.cuota (estado)`);
    await queryRunner.query(`CREATE INDEX idx_grupo_familiar_nombre ON public.grupo_familiar (nombre)`);
    await queryRunner.query(`CREATE INDEX idx_grupo_familiar_orden ON public.grupo_familiar (orden)`);
    await queryRunner.query(`CREATE INDEX idx_notificacion_tipo ON public.notificacion (tipo)`);
    await queryRunner.query(`CREATE INDEX idx_notificacion_socio_id ON public.notificacion (socio_id)`);
    await queryRunner.query(`CREATE INDEX idx_notificacion_leida ON public.notificacion (leida)`);
    await queryRunner.query(`CREATE INDEX idx_pago_cuota ON public.pago_cuota (id_cuota)`);
    await queryRunner.query(`CREATE INDEX idx_pago_fecha ON public.pago_cuota (fecha_pago)`);
    await queryRunner.query(`CREATE INDEX idx_pago_fecha_emision_cuota ON public.pago_cuota (fecha_emision_cuota)`);
    await queryRunner.query(`CREATE INDEX idx_pago_cuota_id_metodo_pago ON public.pago_cuota (id_metodo_pago)`);
    await queryRunner.query(`CREATE INDEX idx_pago_cuota_operacion ON public.pago_cuota (id_cobro_operacion)`);
    await queryRunner.query(`CREATE INDEX idx_pago_cuota_cobrador ON public.pago_cuota (id_cobrador)`);
    await queryRunner.query(`CREATE INDEX idx_registro_socio ON public.registro_ingreso (id_socio)`);
    await queryRunner.query(`CREATE INDEX idx_registro_tipo_ingreso ON public.registro_ingreso (tipo_ingreso)`);
    await queryRunner.query(`CREATE INDEX idx_socio_categoria ON public.socio (id_categoria)`);
    await queryRunner.query(`CREATE INDEX idx_socio_dni ON public.socio (dni)`);
    await queryRunner.query(`CREATE INDEX idx_socio_estado ON public.socio (estado)`);
    await queryRunner.query(`CREATE INDEX idx_socio_grupo_familiar ON public.socio (id_grupo_familiar)`);
    await queryRunner.query(`CREATE INDEX idx_socio_nombre_apellido ON public.socio (apellido, nombre)`);
    await queryRunner.query(`CREATE INDEX idx_socio_temporada_socio ON public.socio_temporada (id_socio)`);
    await queryRunner.query(`CREATE INDEX idx_socio_temporada_temporada ON public.socio_temporada (id_temporada)`);
    await queryRunner.query(`CREATE INDEX idx_temporada_fechas ON public.temporada_pileta (fecha_inicio, fecha_fin)`);
    await queryRunner.query(`CREATE INDEX idx_usuario_usuario ON public.usuario (usuario)`);

    await queryRunner.query(`
      CREATE TRIGGER trg_registro_ingreso_touch
      BEFORE UPDATE ON public.registro_ingreso
      FOR EACH ROW EXECUTE FUNCTION public.set_fecha_hora_ingreso_updated_at()
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_sync_pago_cuota_metodo_pago
      BEFORE INSERT OR UPDATE ON public.pago_cuota
      FOR EACH ROW EXECUTE FUNCTION public.sync_pago_cuota_metodo_pago()
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_metodos_pago_updated_at
      BEFORE UPDATE ON public.metodos_pago
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()
    `);
  }
}
