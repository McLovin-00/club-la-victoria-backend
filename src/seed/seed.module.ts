import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Usuario } from '../auth/entities/usuario.entity';
import { Socio } from '../socios/entities/socio.entity';
import { TemporadaPileta } from '../temporadas/entities/temporada.entity';
import { SocioTemporada } from '../asociaciones/entities/socio-temporada.entity';
import { RegistroIngreso } from '../registro-ingreso/entities/registro-ingreso.entity';
import { CategoriaSocio } from '../categorias-socio/entities/categoria-socio.entity';
import { GrupoFamiliar } from '../grupos-familiares/entities/grupo-familiar.entity';
import { PagoCuota } from '../cobros/entities/pago-cuota.entity';
import { Cuota } from '../cobros/entities/cuota.entity';
import { AppConfigModule } from '../config/AppConfig/app-config.module';
import { AppConfigService } from '../config/AppConfig/app-config.service';

@Module({
  imports: [
    AppConfigModule,
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
          Usuario,
          Socio,
          TemporadaPileta,
          SocioTemporada,
          RegistroIngreso,
          GrupoFamiliar,
          Cuota,
          CategoriaSocio,
          PagoCuota,
        ],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([
      Usuario,
      Socio,
      TemporadaPileta,
      SocioTemporada,
      RegistroIngreso,
      GrupoFamiliar,
      Cuota,
      CategoriaSocio,
      PagoCuota,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
