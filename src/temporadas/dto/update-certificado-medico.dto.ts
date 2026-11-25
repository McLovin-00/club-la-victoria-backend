import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCertificadoMedicoDto {
  @ApiProperty({
    description:
      'Indica si el socio presentó el certificado médico para esta temporada',
    example: true,
  })
  @IsBoolean()
  certificadoMedicoPresentado!: boolean;
}
