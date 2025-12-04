import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed/seed.module';
import { SeedService } from './seed/seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const seedService = app.get(SeedService);
  try {
    await seedService.run();
  } catch (error) {
    console.error('Error durante el seed:', error);
  } finally {
    await app.close();
  }
}
void bootstrap();
