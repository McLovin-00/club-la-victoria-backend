import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriasSocioController } from './categorias-socio.controller';
import { CategoriasSocioService } from './categorias-socio.service';
import { CategoriaSocio } from './entities/categoria-socio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CategoriaSocio])],
  controllers: [CategoriasSocioController],
  providers: [CategoriasSocioService],
  exports: [CategoriasSocioService],
})
export class CategoriasSocioModule {}
