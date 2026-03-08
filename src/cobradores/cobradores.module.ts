import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cobrador,
  CobradorComisionConfig,
  CobradorCuentaCorrienteMovimiento,
  CobradorDispositivo,
} from './entities';
import { CobroOperacion } from '../cobros/entities/cobro-operacion.entity';
import { CobradoresService } from './cobradores.service';
import { CobradoresController } from './cobradores.controller';
import { Socio } from '../socios/entities/socio.entity';
import { Cuota } from '../cobros/entities/cuota.entity';
import { GrupoFamiliar } from '../grupos-familiares/entities/grupo-familiar.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cobrador,
      CobradorDispositivo,
      CobradorComisionConfig,
      CobradorCuentaCorrienteMovimiento,
      CobroOperacion,
      Socio,
      Cuota,
      GrupoFamiliar,
    ]),
  ],
  controllers: [CobradoresController],
  providers: [CobradoresService],
  exports: [CobradoresService],
})
export class CobradoresModule {}
