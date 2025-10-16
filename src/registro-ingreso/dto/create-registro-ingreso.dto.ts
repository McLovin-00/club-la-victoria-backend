import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  Validate,
} from 'class-validator';
import { TipoIngreso, MetodoPago } from '../entities/registro-ingreso.entity';
import { IsValidRegistroIngresoConstraint } from '../validators/registro-ingreso.validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRegistroIngresoDto {
  @Validate(IsValidRegistroIngresoConstraint)
  _validation?: unknown;

  @ApiPropertyOptional({
    description:
      'ID del socio (requerido si tipoIngreso es SOCIO_CLUB o SOCIO_PILETA)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @ValidateIf(
    (o: CreateRegistroIngresoDto) => o.tipoIngreso !== TipoIngreso.NO_SOCIO,
  )
  idSocio?: number;

  @ApiPropertyOptional({
    description: 'DNI del no socio (requerido si tipoIngreso es NO_SOCIO)',
    example: '12345678',
  })
  @IsString()
  @IsOptional()
  @ValidateIf(
    (o: CreateRegistroIngresoDto) => o.tipoIngreso === TipoIngreso.NO_SOCIO,
  )
  dniNoSocio?: string;

  @ApiProperty({
    description: 'Tipo de ingreso de la persona',
    enum: TipoIngreso,
    example: TipoIngreso.SOCIO_CLUB,
  })
  @IsEnum(TipoIngreso)
  tipoIngreso!: TipoIngreso;

  @ApiProperty({
    description: 'Indica si el ingreso habilita el uso de la pileta',
    example: true,
  })
  @IsBoolean()
  habilitaPileta!: boolean;

  @ApiPropertyOptional({
    description: 'Método de pago utilizado (opcional)',
    enum: MetodoPago,
    example: MetodoPago.EFECTIVO,
  })
  @IsEnum(MetodoPago)
  @IsOptional()
  metodoPago?: MetodoPago;

  @ApiPropertyOptional({
    description: 'Importe cobrado por el ingreso (opcional)',
    example: 1000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  importe?: number;
}
