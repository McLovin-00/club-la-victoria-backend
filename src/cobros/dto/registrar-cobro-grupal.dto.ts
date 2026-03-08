import {
  IsString,
  IsNumber,
  IsInt,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsPositive,
  Min,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ActorCobro, OrigenCobro } from '../entities/cobro-operacion.entity';
import { ConceptoCobroDto, PagoMetodoMontoDto } from './cobros.dto';

export class CobroSocioDto {
  @ApiProperty({
    description: 'ID del socio al que aplica este cobro',
    example: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  socioId!: number;

  @ApiProperty({
    description: 'IDs de cuotas a cancelar para este socio',
    example: [101, 102],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  cuotaIds?: number[];

  @ApiProperty({
    description: 'Conceptos no-cuota adicionales para este socio',
    type: [ConceptoCobroDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConceptoCobroDto)
  conceptos?: ConceptoCobroDto[];
}

export class RegistrarCobroGrupalDto {
  @ApiProperty({
    description: 'Lista de cobros a registrar, uno por socio',
    type: [CobroSocioDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un cobro' })
  @ValidateNested({ each: true })
  @Type(() => CobroSocioDto)
  cobros!: CobroSocioDto[];

  @ApiProperty({
    description: 'Distribución de importes por método de pago (1 o 2 métodos)',
    type: [PagoMetodoMontoDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe indicar al menos un método de pago' })
  @ArrayMaxSize(2, { message: 'Solo se permiten hasta dos métodos de pago' })
  @ValidateNested({ each: true })
  @Type(() => PagoMetodoMontoDto)
  pagos!: PagoMetodoMontoDto[];

  @ApiProperty({
    description: 'Actor del cobro',
    enum: ActorCobro,
    example: ActorCobro.COBRADOR,
  })
  @IsEnum(ActorCobro)
  actorCobro!: ActorCobro;

  @ApiProperty({
    description: 'Origen del cobro',
    enum: OrigenCobro,
    example: OrigenCobro.MOBILE,
  })
  @IsEnum(OrigenCobro)
  origenCobro!: OrigenCobro;

  @ApiProperty({
    description: 'ID del cobrador (obligatorio si actor = COBRADOR)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cobradorId?: number;

  @ApiProperty({
    description:
      'Identificador de instalación móvil (opcional; se usa para trazabilidad/idempotencia en clientes móviles)',
    required: false,
    example: 'device-abc123',
  })
  @IsOptional()
  @IsString()
  installationId?: string;

  @ApiProperty({
    description: 'Total de la operación (debe coincidir con suma de líneas)',
    example: 24000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  total!: number;

  @ApiProperty({
    description: 'Clave de idempotencia para evitar dobles registros',
    required: false,
    example: 'device-abc-20260305-op-0001',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
