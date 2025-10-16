import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class ImageValidationPipe implements PipeTransform {
  private readonly MAX_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_MIMETYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  async transform(
    file?: Express.Multer.File,
  ): Promise<Express.Multer.File | undefined> {
    // Si no hay archivo, es v�lido (es opcional)
    if (!file) {
      return undefined;
    }

    // 1. Validar tama�o
    if (file.size > this.MAX_SIZE) {
      throw new BadRequestException(
        `El archivo es demasiado grande. Tama�o m�ximo: 5MB. Tama�o actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    // 2. Validar mimetype
    if (!this.ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Tipos permitidos: ${this.ALLOWED_MIMETYPES.join(', ')}`,
      );
    }

    // 3. Verificar con Sharp que sea una imagen real
    try {
      const metadata = await sharp(file.buffer).metadata();

      if (!metadata.format) {
        throw new BadRequestException('El archivo no es una imagen v�lida');
      }

      // Verificar que el formato detectado por Sharp coincida con el mimetype
      const expectedFormat = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
      const actualFormat = metadata.format === 'jpeg' ? 'jpg' : metadata.format;

      if (actualFormat !== expectedFormat) {
        throw new BadRequestException(
          `La extensi�n del archivo no coincide con su contenido real. Esperado: ${expectedFormat}, Real: ${actualFormat}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'El archivo no es una imagen v�lida o est� corrupto',
      );
    }

    return file;
  }
}
