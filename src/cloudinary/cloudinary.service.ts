// cloudinary.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import {
  CloudinaryResponse,
  CloudinaryDeleteResponse,
} from './cloudinary.response';
import { Readable } from 'stream';
import { CustomError } from 'src/constants/errors/custom-error';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 segundo

  async uploadFile(File: Express.Multer.File): Promise<CloudinaryResponse> {
    return this.uploadWithRetry(File, 1);
  }

  private uploadWithRetry(
    File: Express.Multer.File,
    attempt: number,
  ): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        async (error, result) => {
          if (error) {
            this.logger.error(
              `Error subiendo imagen a Cloudinary (intento ${attempt}/${this.MAX_RETRIES})`,
              error,
            );

            // Reintentar si no hemos alcanzado el máximo de intentos
            if (attempt < this.MAX_RETRIES) {
              this.logger.log(
                `Reintentando subida en ${this.RETRY_DELAY}ms...`,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, this.RETRY_DELAY),
              );
              try {
                const retryResult = await this.uploadWithRetry(
                  File,
                  attempt + 1,
                );
                resolve(retryResult);
              } catch (retryError) {
                reject(retryError);
              }
            } else {
              reject(
                new CustomError(
                  ERROR_MESSAGES.CLOUDINARY_UPLOAD_ERROR,
                  500,
                  ERROR_CODES.INTERNAL_SERVER_ERROR,
                ),
              );
            }
          } else if (!result) {
            reject(
              new CustomError(
                ERROR_MESSAGES.CLOUDINARY_UPLOAD_ERROR,
                500,
                ERROR_CODES.INTERNAL_SERVER_ERROR,
              ),
            );
          } else {
            this.logger.log(
              `Imagen subida exitosamente en intento ${attempt}`,
            );
            resolve(result);
          }
        },
      );

      // Convertir buffer a stream usando módulo nativo de Node.js
      Readable.from(File.buffer).pipe(uploadStream);
    });
  }

  // Borrar imagen usando URL
  async deleteFile(fileUrl: string): Promise<CloudinaryDeleteResponse> {
    // Extraer public_id de la URL
    const urlParts = fileUrl.split('/');
    const filenameWithExt = urlParts[urlParts.length - 1]; // ejemplo: 'miimagen.jpg'
    const publicId = filenameWithExt.split('.')[0]; // 'miimagen'

    const result = (await cloudinary.uploader.destroy(
      publicId,
    )) as CloudinaryDeleteResponse;
    return result; // normalmente { result: 'ok' } o { result: 'not found' }
  }
}
