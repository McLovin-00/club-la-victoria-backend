import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriaSocio } from './entities/categoria-socio.entity';
import { UpdateCategoriaSocioDto } from './dto';
import { CustomError } from 'src/constants/errors/custom-error';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';

/**
 * Servicio para gestión de categorías de socio
 *
 * NOTA: Las categorías son FIJAS según el estatuto del club:
 * - ACTIVO: Socio mayor de edad, paga cuota completa
 * - ADHERENTE: Menores de edad, paga cuota reducida
 * - VITALICIO: 45+ años de antigüedad, NO paga cuota
 * - HONORARIO: Por méritos, NO paga cuota
 *
 * Solo se permite actualizar el monto mensual de cada categoría.
 */
@Injectable()
export class CategoriasSocioService {
  private readonly logger = new Logger(CategoriasSocioService.name);

  constructor(
    @InjectRepository(CategoriaSocio)
    private readonly categoriaRepository: Repository<CategoriaSocio>,
  ) {}

  /**
   * Obtiene todas las categorías
   */
  async findAll(): Promise<CategoriaSocio[]> {
    return await this.categoriaRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtiene una categoría por ID
   */
  async findOne(id: number): Promise<CategoriaSocio> {
    const categoria = await this.categoriaRepository.findOne({
      where: { id },
    });

    if (!categoria) {
      throw new CustomError(
        ERROR_MESSAGES.CATEGORIA_NOT_FOUND,
        404,
        ERROR_CODES.CATEGORIA_NOT_FOUND,
      );
    }

    return categoria;
  }

  /**
   * Obtiene una categoría por nombre
   */
  async findByNombre(nombre: string): Promise<CategoriaSocio | null> {
    return await this.categoriaRepository.findOne({
      where: { nombre },
    });
  }

  /**
   * Actualiza el monto mensual de una categoría
   * Solo se permite actualizar el monto, el nombre y otros campos son fijos
   */
  async update(
    id: number,
    updateCategoriaDto: UpdateCategoriaSocioDto,
  ): Promise<CategoriaSocio> {
    try {
      const categoria = await this.findOne(id);

      // Solo actualizar el monto mensual
      if (updateCategoriaDto.montoMensual !== undefined) {
        categoria.montoMensual = updateCategoriaDto.montoMensual;
      }

      return await this.categoriaRepository.save(categoria);
    } catch (error) {
      this.logger.error(
        `Error actualizando categoría ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError(
        ERROR_MESSAGES.ERROR_UPDATING_CATEGORIA,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
