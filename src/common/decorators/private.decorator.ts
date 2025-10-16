import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export function Private() {
  return applyDecorators(UseGuards(AuthGuard('jwt')));
}
