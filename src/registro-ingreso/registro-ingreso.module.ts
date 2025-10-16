import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { RegistroIngreso } from './entities/registro-ingreso.entity';
import { RegistroIngresoService } from './registro-ingreso.service';
import { RegistroIngresoController } from './registro-ingreso.controller';
import { RegistroIngresoGateway } from './registro-ingreso.gateway';
import { Socio } from '../socios/entities/socio.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RegistroIngreso, Socio]),
    JwtModule.register({}), // Import JwtModule for WebSocket authentication
  ],
  controllers: [RegistroIngresoController],
  providers: [RegistroIngresoService, RegistroIngresoGateway],
  exports: [RegistroIngresoService],
})
export class RegistroIngresoModule {}
