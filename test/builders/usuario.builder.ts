import { Usuario } from '../../src/auth/entities/usuario.entity';

type UsuarioBuilderOptions = Partial<Usuario>;

/**
 * Builder para crear instancias de Usuario para tests
 */
export class UsuarioBuilder {
  private usuario: Partial<Usuario>;

  constructor(options: UsuarioBuilderOptions = {}) {
    this.usuario = {
    id: 1,
    usuario: 'testuser',
    password: 'hashed_password_123',
    ...options,
  };
  }

  withId(id: number): this {
    this.usuario.id = id;
    return this;
  }

  withUsuario(usuario: string): this {
    this.usuario.usuario = usuario;
    return this;
  }

  withPassword(password: string): this {
    this.usuario.password = password;
    return this;
  }

  build(): Partial<Usuario> {
    return { ...this.usuario } as Usuario;
  }
}
