import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check endpoint',
    description:
      'Verifica el estado de salud de la aplicación incluyendo base de datos, memoria y almacenamiento',
  })
  @ApiResponse({
    status: 200,
    description: 'La aplicación está funcionando correctamente',
  })
  @ApiResponse({
    status: 503,
    description: 'Uno o más servicios están fallando',
  })
  check() {
    return this.health.check([
      // Verifica la conexión a la base de datos
      () => this.db.pingCheck('database'),
      // Verifica que el heap de memoria no exceda 150MB
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      // Verifica que el RSS de memoria no exceda 300MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      // Verifica que el almacenamiento no exceda 90% de uso (mínimo 10% libre)
      () =>
        this.disk.checkStorage('storage', {
          path: process.cwd(),
          thresholdPercent: 0.9,
        }),
    ]);
  }
}
