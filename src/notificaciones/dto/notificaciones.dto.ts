import { ApiProperty } from '@nestjs/swagger';
import { TipoNotificacion } from '../entities/notificacion.entity';

export class NotificacionResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ enum: TipoNotificacion })
  tipo!: TipoNotificacion;

  @ApiProperty({ example: 5 })
  socioId!: number;

  @ApiProperty({ example: 'Pedro Rodríguez' })
  socioNombre!: string;

  @ApiProperty({ example: 'Adeuda 3 meses - Se inhabilitará el próximo mes' })
  mensaje!: string;

  @ApiProperty({ example: false })
  leida!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class NotificacionesListDto {
  @ApiProperty({ type: [NotificacionResponseDto] })
  notificaciones!: NotificacionResponseDto[];

  @ApiProperty({ example: 5 })
  totalNoLeidas!: number;
}

export class ContadorNotificacionesDto {
  @ApiProperty({ example: 5 })
  totalNoLeidas!: number;
}
