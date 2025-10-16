import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { UsuarioRepository } from './repositories/usuario.repository';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { IJwtPayload } from './entities/jwt-payload.interface';
import { CustomError } from 'src/constants/errors/custom-error';
import { AUTH } from 'src/constants/auth.constants';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarioRepository: UsuarioRepository,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(input: LoginDto) {
    const userDb = await this.usuarioRepository.findByUsername(input.usuario);
    if (!userDb) {
      throw new CustomError(
        ERROR_MESSAGES.USER_NOT_FOUND,
        404,
        ERROR_CODES.USER_NOT_FOUND,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      userDb.password,
    );
    if (!isPasswordValid) {
      throw new CustomError(
        ERROR_MESSAGES.INVALID_PASSWORD,
        401,
        ERROR_CODES.INVALID_PASSWORD,
      );
    }

    return userDb;
  }

  async login(user: LoginDto) {
    const usuario = await this.validateUser(user);

    const payload: IJwtPayload = {
      usuario: usuario.usuario,
    };

    const token = await this.jwtService.signAsync(payload);

    return token;
  }

  async generarPasswordHash(password: string) {
    return await bcrypt.hash(password, AUTH.BCRYPT_SALT_ROUNDS);
  }
}
