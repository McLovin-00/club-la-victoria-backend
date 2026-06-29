import { IsOptional, IsInt, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export enum EstadoFilter {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  MOROSO = 'MOROSO',
}

export class FilterSocioDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoriaId?: number;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @IsEnum(EstadoFilter)
  estado?: EstadoFilter;

  @IsOptional()
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
  tarjetaCentro?: boolean;
}
