import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GruposFamiliaresController } from './grupos-familiares.controller';
import { GruposFamiliaresService } from './grupos-familiares.service';
import { GrupoFamiliar } from './entities/grupo-familiar.entity';
import { Socio } from '../socios/entities/socio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GrupoFamiliar, Socio])],
  controllers: [GruposFamiliaresController],
  providers: [GruposFamiliaresService],
  exports: [GruposFamiliaresService],
})
export class GruposFamiliaresModule {}
