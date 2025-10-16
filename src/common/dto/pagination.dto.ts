import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PAGINATION } from 'src/constants/pagination.constants';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = PAGINATION.DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = PAGINATION.DEFAULT_LIMIT;

  @IsOptional()
  @Type(() => String)
  @IsString()
  search?: string;
}
