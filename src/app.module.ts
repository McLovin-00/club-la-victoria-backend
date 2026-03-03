import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SociosModule } from './socios/socios.module';
import { TemporadasModule } from './temporadas/temporadas.module';
import { RegistroIngresoModule } from './registro-ingreso/registro-ingreso.module';
import { AsociacionesModule } from './asociaciones/asociaciones.module';
import { CategoriasSocioModule } from './categorias-socio/categorias-socio.module';
import { CobrosModule } from './cobros/cobros.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from './config/AppConfig/app-config.service';
import { Socio } from './socios/entities/socio.entity';
import { TemporadaPileta } from './temporadas/entities/temporada.entity';
import { SocioTemporada } from './asociaciones/entities/socio-temporada.entity';
import { Usuario } from './auth/entities/usuario.entity';
import { RegistroIngreso } from './registro-ingreso/entities/registro-ingreso.entity';
import { CategoriaSocio } from './categorias-socio/entities/categoria-socio.entity';
import { Cuota } from './cobros/entities/cuota.entity';
import { PagoCuota } from './cobros/entities/pago-cuota.entity';
import { Notificacion } from './notificaciones/entities/notificacion.entity';
import { GrupoFamiliar } from './grupos-familiares/entities/grupo-familiar.entity';
import { GruposFamiliaresModule } from './grupos-familiares/grupos-familiares.module';

import { AppConfigModule } from './config/AppConfig/app-config.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EstadisticasModule } from './estadisticas/estadisticas.module';
import { HealthModule } from './health/health.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AUTH } from './constants/auth.constants';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { CategoriaSocioJob } from './jobs/categoria-socio.job';
import { CategoriaRulesService } from './socios/services/categoria-rules.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: AUTH.RATE_LIMIT_TTL,
        limit: AUTH.RATE_LIMIT_MAX_REQUESTS,
      },
    ]),
    AuthModule,
    SociosModule,
    TemporadasModule,
    RegistroIngresoModule,
    AsociacionesModule,
    EstadisticasModule,
    HealthModule,
    CategoriasSocioModule,
    CobrosModule,
    GruposFamiliaresModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => ({
        type: 'postgres',
        host: configService.getDatabaseHost(),
        username: configService.getDatabaseUser(),
        password: configService.getDatabasePassword(),
        port: configService.getDatabasePort(),
        database: configService.getDatabaseName(),
        timezone: 'America/Argentina/Buenos_Aires',
        entities: [
          Socio,
          TemporadaPileta,
          SocioTemporada,
          Usuario,
          RegistroIngreso,
          CategoriaSocio,
          Cuota,
          PagoCuota,
          Notificacion,
          GrupoFamiliar,
        ],

        synchronize: configService.getNodeEnv() === 'development',
      }),
    }),
    CloudinaryModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    CategoriaRulesService,
    CategoriaSocioJob,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
