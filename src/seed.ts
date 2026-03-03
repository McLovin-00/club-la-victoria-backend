import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed/seed.module';
import { SeedService } from './seed/seed.service';

/**
 * Script de seed para la base de datos
 *
 * Se ejecuta automáticamente según NODE_ENV:
 * - NODE_ENV=development → Ejecuta seed completo (categorías + usuarios, socios, etc.)
 * - NODE_ENV=production → Ejecuta solo categorías (datos esenciales)
 *
 * También se puede forzar con flags:
 * - `bun run seed` → Usa NODE_ENV actual
 * - `bun run seed -- --dev` → Fuerza modo desarrollo
 * - `bun run seed -- --prod` → Fuerza modo producción
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const seedService = app.get(SeedService);

  // Determinar modo de ejecución
  // Prioridad: flag > NODE_ENV > default (solo categorías)
  const forceDev = process.argv.includes('--dev');
  const forceProd = process.argv.includes('--prod');
  const nodeEnv = process.env.NODE_ENV || 'production';

  const isDevMode = forceDev || (!forceProd && nodeEnv === 'development');

  console.log(
    `🌱 Ejecutando seed en modo: ${isDevMode ? 'DESARROLLO' : 'PRODUCCIÓN'}`,
  );

  try {
    // SIEMPRE ejecutar el seed base (categorías)
    await seedService.run();

    // Solo ejecutar seed de desarrollo si corresponde
    if (isDevMode) {
      await seedService.runDevSeed();
    }

    console.log('✅ Seed completado exitosamente');
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}
void bootstrap();
