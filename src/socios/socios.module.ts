import { Module } from '@nestjs/common';
import { SociosService } from './socios.service';
import { SociosController } from './socios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Socio } from './entities/socio.entity';
import { SocioRepository } from './repositories/socio.repository';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { AsociacionesRepository } from 'src/asociaciones/repositories/asociaciones.repository';
import { TemporadaPiletaRepository } from 'src/temporadas/repositories/temporada.repository';
import { CategoriasSocioModule } from 'src/categorias-socio/categorias-socio.module';
import { CategoriaRulesService } from './services/categoria-rules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Socio,
      AsociacionesRepository,
      TemporadaPiletaRepository,
    ]),
    CategoriasSocioModule,
  ],
  controllers: [SociosController],
  providers: [
    SociosService,
    SocioRepository,
    CloudinaryService,
    AsociacionesRepository,
    TemporadaPiletaRepository,
    CategoriaRulesService,
  ],
})
export class SociosModule {}
