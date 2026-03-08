import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetodoPago } from './entities/metodo-pago.entity';

@Injectable()
export class MetodosPagoService {
  constructor(
    @InjectRepository(MetodoPago)
    private metodoPagoRepository: Repository<MetodoPago>,
  ) {}

  async findAll(): Promise<MetodoPago[]> {
    return this.metodoPagoRepository
      .createQueryBuilder('metodo')
      .where('metodo.activo = :activo', { activo: true })
      .orderBy('metodo.orden', 'ASC')
      .getMany();
  }
}
