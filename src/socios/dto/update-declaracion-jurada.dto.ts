import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDeclaracionJuradaDto {
  @ApiProperty({
    description: 'Estado de la declaración jurada',
    example: true,
  })
  @Transform(
    ({ value }) => {
      if (value === true || value === 'true' || value === 1 || value === '1')
        return true;
      if (
        value === false ||
        value === 'false' ||
        value === 0 ||
        value === '0' ||
        value === ''
      )
        return false;
      return undefined;
    },
    { toClassOnly: true },
  )
  @IsBoolean()
  declaracionJurada!: boolean;
}
