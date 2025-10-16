import { Injectable } from '@nestjs/common';
import { Usuario } from '../entities/usuario.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class UsuarioRepository extends Repository<Usuario> {
  constructor(private dataSource: DataSource) {
    super(Usuario, dataSource.createEntityManager());
  }

  async findByUsername(username: string) {
    return await this.findOne({
      where: { usuario: username },
    });
  }
}
