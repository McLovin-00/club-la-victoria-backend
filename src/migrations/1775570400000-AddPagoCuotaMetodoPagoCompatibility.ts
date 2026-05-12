import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPagoCuotaMetodoPagoCompatibility1775570400000
  implements MigrationInterface
{
  name = 'AddPagoCuotaMetodoPagoCompatibility1775570400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ exists }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pago_cuota'
          AND column_name = 'metodo_pago'
      ) AS "exists"
    `);

    if (!exists) {
      return;
    }

    await queryRunner.query(`
      UPDATE pago_cuota pc
      SET id_metodo_pago = mp.id_metodo_pago
      FROM metodos_pago mp
      WHERE pc.id_metodo_pago IS NULL
        AND pc.metodo_pago IS NOT NULL
        AND upper(btrim(pc.metodo_pago)) = upper(btrim(mp.nombre))
    `);

    await queryRunner.query(`
      UPDATE pago_cuota pc
      SET metodo_pago = mp.nombre
      FROM metodos_pago mp
      WHERE pc.id_metodo_pago = mp.id_metodo_pago
        AND (pc.metodo_pago IS NULL OR btrim(pc.metodo_pago) = '')
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_pago_cuota_metodo_pago()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.id_metodo_pago IS NOT NULL
          AND (NEW.metodo_pago IS NULL OR btrim(NEW.metodo_pago) = '')
        THEN
          SELECT nombre
          INTO NEW.metodo_pago
          FROM metodos_pago
          WHERE id_metodo_pago = NEW.id_metodo_pago;
        END IF;

        IF NEW.id_metodo_pago IS NULL
          AND NEW.metodo_pago IS NOT NULL
        THEN
          SELECT id_metodo_pago
          INTO NEW.id_metodo_pago
          FROM metodos_pago
          WHERE upper(btrim(nombre)) = upper(btrim(NEW.metodo_pago))
          ORDER BY id_metodo_pago
          LIMIT 1;
        END IF;

        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_sync_pago_cuota_metodo_pago ON pago_cuota
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_sync_pago_cuota_metodo_pago
      BEFORE INSERT OR UPDATE ON pago_cuota
      FOR EACH ROW
      EXECUTE FUNCTION sync_pago_cuota_metodo_pago()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ exists }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pago_cuota'
          AND column_name = 'metodo_pago'
      ) AS "exists"
    `);

    if (!exists) {
      return;
    }

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_sync_pago_cuota_metodo_pago ON pago_cuota
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS sync_pago_cuota_metodo_pago
    `);
  }
}
