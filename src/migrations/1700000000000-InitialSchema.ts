import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Esta migración representa el estado inicial del schema
    // Las tablas ya fueron creadas manualmente en producción
    // Esta migración sirve como baseline para futuras migraciones

    // Si la base de datos está vacía, crear todo el schema:
    const tables = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    if (tables.length === 0) {
      // Crear enums
      await queryRunner.query(`
        CREATE TYPE "public"."estado_socio" AS ENUM('ACTIVO', 'INACTIVO', 'PENDIENTE', 'MOROSO')
      `);
      await queryRunner.query(`
        CREATE TYPE "public"."genero_socio" AS ENUM('MASCULINO', 'FEMENINO', 'OTRO')
      `);
      await queryRunner.query(`
        CREATE TYPE "public"."actor_cobro" AS ENUM('COBRADOR', 'OPERADOR')
      `);
      await queryRunner.query(`
        CREATE TYPE "public"."origen_cobro" AS ENUM('MOBILE', 'WEB')
      `);
      await queryRunner.query(`
        CREATE TYPE "public"."tipo_linea_cobro" AS ENUM('CUOTA', 'CONCEPTO')
      `);
      await queryRunner.query(`
        CREATE TYPE "public"."tipo_movimiento_cobrador" AS ENUM('COMISION_GENERADA', 'PAGO_A_COBRADOR', 'AJUSTE')
      `);

      // Crear tablas base
      await queryRunner.query(`
        CREATE TABLE "usuario" (
          "id_usuario" SERIAL PRIMARY KEY,
          "email" character varying(120) NOT NULL,
          "password" character varying(255) NOT NULL,
          "nombre" character varying(120) NOT NULL,
          "apellido" character varying(120) NOT NULL,
          "rol" character varying(50) NOT NULL,
          "activo" boolean NOT NULL DEFAULT true,
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now(),
          CONSTRAINT "uq_usuario_email" UNIQUE ("email")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "temporada_pileta" (
          "id_temporada" SERIAL PRIMARY KEY,
          "nombre" character varying(100) NOT NULL,
          "fecha_inicio" date NOT NULL,
          "fecha_fin" date NOT NULL,
          "precio_base" decimal(10,2) NOT NULL,
          "activa" boolean NOT NULL DEFAULT false
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "grupo_familiar" (
          "id_grupo_familiar" SERIAL PRIMARY KEY,
          "nombre_grupo" character varying(150) NOT NULL,
          "created_at" TIMESTAMP DEFAULT now()
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "categoria_socio" (
          "id_categoria_socio" SERIAL PRIMARY KEY,
          "nombre" character varying(100) NOT NULL,
          "descripcion" character varying(255),
          "edad_minima" integer,
          "edad_maxima" integer,
          "activa" boolean NOT NULL DEFAULT true
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "socio" (
          "id_socio" SERIAL PRIMARY KEY,
          "dni" character varying(20) NOT NULL,
          "nombre" character varying(100) NOT NULL,
          "apellido" character varying(100) NOT NULL,
          "email" character varying(150),
          "telefono" character varying(30),
          "direccion" character varying(255),
          "fecha_nacimiento" date,
          "genero" genero_socio,
          "estado" estado_socio NOT NULL DEFAULT 'PENDIENTE',
          "foto_url" character varying(500),
          "id_categoria_socio" integer,
          "id_grupo_familiar" integer,
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now(),
          CONSTRAINT "fk_socio_categoria" FOREIGN KEY ("id_categoria_socio") REFERENCES "categoria_socio"("id_categoria_socio"),
          CONSTRAINT "fk_socio_grupo" FOREIGN KEY ("id_grupo_familiar") REFERENCES "grupo_familiar"("id_grupo_familiar"),
          CONSTRAINT "uq_socio_dni" UNIQUE ("dni")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "socio_temporada" (
          "id_socio_temporada" SERIAL PRIMARY KEY,
          "id_socio" integer NOT NULL,
          "id_temporada" integer NOT NULL,
          "precio_acordado" decimal(10,2) NOT NULL,
          "fecha_inscripcion" date NOT NULL,
          "activo" boolean NOT NULL DEFAULT true,
          CONSTRAINT "fk_socio_temporada_socio" FOREIGN KEY ("id_socio") REFERENCES "socio"("id_socio"),
          CONSTRAINT "fk_socio_temporada_temporada" FOREIGN KEY ("id_temporada") REFERENCES "temporada_pileta"("id_temporada")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "registro_ingreso" (
          "id_registro" SERIAL PRIMARY KEY,
          "id_socio" integer NOT NULL,
          "fecha_hora" TIMESTAMP NOT NULL DEFAULT now(),
          "tipo_ingreso" character varying(50) NOT NULL,
          "observaciones" character varying(255),
          CONSTRAINT "fk_registro_socio" FOREIGN KEY ("id_socio") REFERENCES "socio"("id_socio")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "notificacion" (
          "id_notificacion" SERIAL PRIMARY KEY,
          "id_usuario" integer NOT NULL,
          "titulo" character varying(150) NOT NULL,
          "mensaje" text NOT NULL,
          "leida" boolean NOT NULL DEFAULT false,
          "created_at" TIMESTAMP DEFAULT now(),
          CONSTRAINT "fk_notificacion_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "metodos_pago" (
          "id_metodo_pago" SERIAL PRIMARY KEY,
          "nombre" character varying(80) NOT NULL,
          "descripcion" character varying(255),
          "activo" boolean NOT NULL DEFAULT true
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "cuota" (
          "id_cuota" SERIAL PRIMARY KEY,
          "id_socio_temporada" integer NOT NULL,
          "numero_cuota" integer NOT NULL,
          "monto" decimal(10,2) NOT NULL,
          "fecha_vencimiento" date,
          "estado" character varying(30) NOT NULL DEFAULT 'PENDIENTE',
          CONSTRAINT "fk_cuota_socio_temporada" FOREIGN KEY ("id_socio_temporada") REFERENCES "socio_temporada"("id_socio_temporada")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "cobrador" (
          "id_cobrador" SERIAL PRIMARY KEY,
          "dni" character varying(20) NOT NULL,
          "nombre" character varying(100) NOT NULL,
          "apellido" character varying(100) NOT NULL,
          "telefono" character varying(30),
          "email" character varying(150),
          "direccion" character varying(255),
          "activo" boolean NOT NULL DEFAULT true,
          "porcentaje_comision" decimal(5,2) NOT NULL DEFAULT 10.00,
          "saldo_a_favor" decimal(12,2) NOT NULL DEFAULT 0,
          "created_at" TIMESTAMP DEFAULT now(),
          "updated_at" TIMESTAMP DEFAULT now(),
          CONSTRAINT "uq_cobrador_dni" UNIQUE ("dni")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "cobrador_comision_config" (
          "id_config" SERIAL PRIMARY KEY,
          "id_cobrador" integer NOT NULL,
          "porcentaje" decimal(5,2) NOT NULL,
          "vigente_desde" date NOT NULL,
          "vigente_hasta" date,
          CONSTRAINT "fk_config_cobrador" FOREIGN KEY ("id_cobrador") REFERENCES "cobrador"("id_cobrador")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "pago_cuota" (
          "id_pago" SERIAL PRIMARY KEY,
          "id_cuota" integer NOT NULL,
          "monto_pagado" decimal(10,2) NOT NULL,
          "fecha_pago" date NOT NULL,
          "id_metodo_pago" integer NOT NULL,
          "observaciones" character varying(255),
          "id_cobro_operacion" integer,
          CONSTRAINT "fk_pago_cuota" FOREIGN KEY ("id_cuota") REFERENCES "cuota"("id_cuota"),
          CONSTRAINT "fk_pago_metodo" FOREIGN KEY ("id_metodo_pago") REFERENCES "metodos_pago"("id_metodo_pago")
        )
      `);

      await queryRunner.query(`
        CREATE TABLE "cobro_operacion" (
          "id_cobro_operacion" SERIAL PRIMARY KEY,
          "id_socio" integer NOT NULL,
          "id_metodo_pago" integer NOT NULL,
          "actor_cobro" actor_cobro NOT NULL,
          "origen_cobro" origen_cobro NOT NULL,
          "id_cobrador" integer,
          "idempotency_key" character varying(128),
          "total" decimal(12,2) NOT NULL,
          "referencia" character varying(255),
          "observaciones" character varying(255),
          "fecha_hora_servidor" TIMESTAMP DEFAULT now(),
          CONSTRAINT "fk_cobro_operacion_socio" FOREIGN KEY ("id_socio") REFERENCES "socio"("id_socio"),
          CONSTRAINT "fk_cobro_operacion_metodo" FOREIGN KEY ("id_metodo_pago") REFERENCES "metodos_pago"("id_metodo_pago"),
          CONSTRAINT "fk_cobro_operacion_cobrador" FOREIGN KEY ("id_cobrador") REFERENCES "cobrador"("id_cobrador"),
          CONSTRAINT "uq_cobro_operacion_idempotency" UNIQUE ("idempotency_key")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_cobro_operacion_socio" ON "cobro_operacion"("id_socio")`);
      await queryRunner.query(`CREATE INDEX "idx_cobro_operacion_cobrador" ON "cobro_operacion"("id_cobrador")`);

      await queryRunner.query(`
        CREATE TABLE "cobro_operacion_linea" (
          "id_cobro_operacion_linea" SERIAL PRIMARY KEY,
          "id_cobro_operacion" integer NOT NULL,
          "tipo_linea" tipo_linea_cobro NOT NULL,
          "id_cuota" integer,
          "concepto" character varying(80),
          "descripcion" character varying(255),
          "monto" decimal(12,2) NOT NULL,
          CONSTRAINT "fk_linea_operacion" FOREIGN KEY ("id_cobro_operacion") REFERENCES "cobro_operacion"("id_cobro_operacion") ON DELETE CASCADE,
          CONSTRAINT "fk_linea_cuota" FOREIGN KEY ("id_cuota") REFERENCES "cuota"("id_cuota")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_cobro_operacion_linea_operacion" ON "cobro_operacion_linea"("id_cobro_operacion")`);

      await queryRunner.query(`
        CREATE TABLE "cobrador_cuenta_corriente_movimiento" (
          "id_cobrador_movimiento" SERIAL PRIMARY KEY,
          "id_cobrador" integer NOT NULL,
          "tipo_movimiento" tipo_movimiento_cobrador NOT NULL,
          "monto" decimal(12,2) NOT NULL,
          "id_cobro_operacion" integer,
          "usuario_registra" character varying(120),
          "observacion" character varying(255),
          "referencia" character varying(255),
          "created_at" TIMESTAMP DEFAULT now(),
          CONSTRAINT "fk_movimiento_cobrador" FOREIGN KEY ("id_cobrador") REFERENCES "cobrador"("id_cobrador"),
          CONSTRAINT "fk_movimiento_operacion" FOREIGN KEY ("id_cobro_operacion") REFERENCES "cobro_operacion"("id_cobro_operacion")
        )
      `);
      await queryRunner.query(`CREATE INDEX "idx_cobrador_mov_fecha" ON "cobrador_cuenta_corriente_movimiento"("id_cobrador", "created_at")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop en orden inverso (respetando foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "cobrador_cuenta_corriente_movimiento"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cobro_operacion_linea"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cobro_operacion"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pago_cuota"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cobrador_comision_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cobrador"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cuota"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "metodos_pago"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notificacion"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "registro_ingreso"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "socio_temporada"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "socio"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grupo_familiar"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categoria_socio"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "temporada_pileta"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "usuario"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "tipo_movimiento_cobrador"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tipo_linea_cobro"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "origen_cobro"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "actor_cobro"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "genero_socio"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "estado_socio"`);
  }
}
