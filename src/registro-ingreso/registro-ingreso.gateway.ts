import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { RegistroIngreso } from './entities/registro-ingreso.entity';
import { getDayStartEnd } from 'src/util/day-start-end-util';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*', // Permitir todas las conexiones (app móvil + web)
    credentials: false,
  },
  namespace: '/registro-ingreso',
})
export class RegistroIngresoGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RegistroIngresoGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @InjectRepository(RegistroIngreso)
    private readonly registroRepo: Repository<RegistroIngreso>,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connected: ${client.id}`);

      const registros = await this.returnRegistrosPiletaHoy();

      // Enviar lista inicial al cliente que se conecta
      client.emit('pileta:registros', registros);
      // Compatibilidad con cliente móvil: evento esperado 'registrosPiletaHoy'
      client.emit('registrosPiletaHoy', registros);
    } catch (error) {
      this.logger.error(
        'Error al obtener registros iniciales de pileta',
        (error as Error)?.stack ?? String(error),
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Emitir lista completa actualizada a todos los clientes
  async emitUpdatedList() {
    try {
      const registros = await this.returnRegistrosPiletaHoy();
      this.server?.emit('pileta:registros', registros);
      // Compatibilidad con cliente móvil
      this.server?.emit('registrosPiletaHoy', registros);
    } catch (error) {
      this.logger.error(
        'Error al emitir lista actualizada de pileta',
        (error as Error)?.stack ?? String(error),
      );
    }
  }

  // Emitir un nuevo registro (opcional: también se emite la lista completa)
  emitNuevoRegistro(registro: RegistroIngreso) {
    this.server?.emit('pileta:nuevo', registro);
  }

  @SubscribeMessage('getRegistrosPiletaHoy')
  async handleGetRegistrosPiletaHoy(client: Socket) {
    try {
      client.emit('registrosPiletaHoy', await this.returnRegistrosPiletaHoy());
    } catch (error) {
      this.logger.error(
        'Error al manejar getRegistrosPiletaHoy',
        (error as Error)?.stack ?? String(error),
      );
      client.emit('error', { message: 'Error obteniendo registros de pileta' });
    }
  }

  private async returnRegistrosPiletaHoy() {
    try {
      const { inicioDia, finDia } = getDayStartEnd();
      const registros = await this.registroRepo.find({
        where: {
          habilitaPileta: true,
          fechaHoraIngreso: Between(inicioDia, finDia),
        },
        relations: ['socio'],
        order: { fechaHoraIngreso: 'DESC' },
      });
      return registros;
    } catch (error) {
      this.logger.error(
        'Error al manejar getRegistrosPiletaHoy',
        (error as Error)?.stack ?? String(error),
      );
      return [];
    }
  }
}
