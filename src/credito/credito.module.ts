import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditoService } from './credito.service';
import { CreditoIndividual } from './entities/credito-individual.entity';
import { CreditoGrupal } from './entities/credito-grupal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreditoIndividual, CreditoGrupal])],
  providers: [CreditoService],
  exports: [CreditoService, TypeOrmModule],
})
export class CreditoModule {}