import { Module } from '@nestjs/common';
import { TemporadasService } from './temporadas.service';
import { TemporadasController } from './temporadas.controller';
import { TemporadaPileta } from './entities/temporada.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemporadaPiletaRepository } from './repositories/temporada.repository';
import { SocioRepository } from 'src/socios/repositories/socio.repository';
import { AsociacionesRepository } from 'src/asociaciones/repositories/asociaciones.repository';
import { RegistroIngreso } from 'src/registro-ingreso/entities/registro-ingreso.entity';
import { RegistroIngresoRepository } from 'src/registro-ingreso/repositories/registro-ingreso.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TemporadaPileta, RegistroIngreso])],
  controllers: [TemporadasController],
  providers: [
    TemporadasService,
    TemporadaPiletaRepository,
    SocioRepository,
    AsociacionesRepository,
    RegistroIngresoRepository,
  ],
})
export class TemporadasModule {}
