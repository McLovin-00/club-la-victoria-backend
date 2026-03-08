import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobrosController } from './cobros.controller';
import { CobrosService } from './cobros.service';
import { Cuota } from './entities/cuota.entity';
import { PagoCuota } from './entities/pago-cuota.entity';
import { CobroOperacion } from './entities/cobro-operacion.entity';
import { CobroOperacionLinea } from './entities/cobro-operacion-linea.entity';
import { Socio } from '../socios/entities/socio.entity';
import { TalonarioPdfService } from './services/talonario-pdf.service';
import { TarjetaCentro23fService } from './services/tarjeta-centro-23f.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AppConfigModule } from '../config/AppConfig/app-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cuota,
      PagoCuota,
      CobroOperacion,
      CobroOperacionLinea,
      Socio,
    ]),
    NotificacionesModule,
    AppConfigModule,
  ],
  controllers: [CobrosController],
  providers: [CobrosService, TalonarioPdfService, TarjetaCentro23fService],
  exports: [CobrosService, TalonarioPdfService, TarjetaCentro23fService],
})
export class CobrosModule {}
