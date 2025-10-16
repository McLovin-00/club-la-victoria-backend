import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Generar o usar request ID existente
    const requestId = req.headers['x-request-id'] || randomUUID();

    // Agregar request ID al request
    req.headers['x-request-id'] = requestId as string;

    // Agregar request ID a la respuesta
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
