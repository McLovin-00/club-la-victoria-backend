import { Injectable } from '@nestjs/common';
import { RegistroIngreso } from '../entities/registro-ingreso.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class RegistroIngresoRepository extends Repository<RegistroIngreso> {
  constructor(private dataSource: DataSource) {
    super(RegistroIngreso, dataSource.createEntityManager());
  }
}
