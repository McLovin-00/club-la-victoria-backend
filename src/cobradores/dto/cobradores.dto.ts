import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class VincularCobradorDispositivoDto {
  @ApiProperty({
    description: 'Identificador único de instalación/dispositivo',
    example: 'android-2f0e8e9f-9e4e-4f2d-b8fd-2e1a9a8d3d5c',
  })
  @IsString()
  installationId!: string;

  @ApiProperty({
    description: 'ID del cobrador seleccionado',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cobradorId!: number;
}

export class ConfigurarComisionCobradorDto {
  @ApiProperty({
    description:
      'Porcentaje de comisión en formato decimal (0.15) o porcentaje entero (15 para 15%)',
    example: 15,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  porcentaje!: number;

  @ApiProperty({
    description: 'Fecha de vigencia desde (ISO 8601)',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsDateString()
  vigenteDesde!: string;
}

export class RegistrarMovimientoCobradorDto {
  @ApiProperty({
    description: 'Monto del movimiento',
    example: 50000,
  })
  @Type(() => Number)
  @IsNumber()
  monto!: number;

  @ApiProperty({
    description: 'Usuario que registra el movimiento',
    required: false,
    example: 'operador_admin',
  })
  @IsOptional()
  @IsString()
  usuarioRegistra?: string;

  @ApiProperty({
    description: 'Observación del movimiento',
    required: false,
    example: 'Pago quincenal al cobrador',
  })
  @IsOptional()
  @IsString()
  observacion?: string;

  @ApiProperty({
    description: 'Referencia de control',
    required: false,
    example: 'REC-2026-0001',
  })
  @IsOptional()
  @IsString()
  referencia?: string;
}

export class RangoFechasDto {
  @ApiProperty({
    description: 'Fecha/hora desde (ISO 8601)',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsDateString()
  desde!: string;

  @ApiProperty({
    description: 'Fecha/hora hasta (ISO 8601)',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsDateString()
  hasta!: string;
}

export class ActualizarMovimientoCobradorDto {
  @ApiProperty({
    description: 'Monto del movimiento',
    required: false,
    example: 50000,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  monto?: number;

  @ApiProperty({
    description: 'Usuario que registra el movimiento',
    required: false,
    example: 'operador_admin',
  })
  @IsOptional()
  @IsString()
  usuarioRegistra?: string;

  @ApiProperty({
    description: 'Referencia de control',
    required: false,
    example: 'REC-2026-0001',
  })
  @IsOptional()
  @IsString()
  referencia?: string;
}
