import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule } from 'src/config/AppConfig/app-config.module';
import { AppConfigService } from 'src/config/AppConfig/app-config.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity';
import { UsuarioRepository } from './repositories/usuario.repository';
import { JwtStrategy } from '../common/strategies/jwt-auth.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.getJwtSecret(),
        signOptions: {
          expiresIn: config.getJwtExpiresIn(),
        },
      }),
    }),
    TypeOrmModule.forFeature([Usuario]),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsuarioRepository, JwtStrategy, AppConfigService],
})
export class AuthModule {}
