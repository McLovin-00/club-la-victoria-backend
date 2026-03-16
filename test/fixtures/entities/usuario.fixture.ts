import { Usuario } from '../../../src/auth/entities/usuario.entity';

export const usuarioFixture: Usuario = {
  id: 1,
  usuario: 'admin',
  password: 'hashed_password_123',
};

export const usuarioFixtureWithPassword: Usuario = {
  ...usuarioFixture,
  password: 'new_hashed_password',
};
