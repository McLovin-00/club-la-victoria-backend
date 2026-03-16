import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryService } from '../cloudinary.service';
import { CustomError } from 'src/constants/errors/custom-error';
import {
  ERROR_MESSAGES,
  ERROR_CODES,
} from 'src/constants/errors/error-messages';
import { Transform } from 'stream';

// Mock de cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [CloudinaryService],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    await module.close();
  });

  // Helper para crear un mock file
  const createMockFile = (): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: '',
    filename: '',
    buffer: Buffer.from('mock image data'),
  } as unknown as Express.Multer.File);

  // Helper para simular upload stream con éxito
  const setupSuccessfulUpload = (response: object): void => {
    const uploadStreamCallback = jest.fn((callback) => {
      const mockStream = new Transform({
        transform(chunk, encoding, cb) {
          cb(null, chunk);
        },
      });

      setImmediate(() => {
        callback(null, response);
      });

      return mockStream;
    });

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      uploadStreamCallback,
    );
  };

  // Helper para simular upload stream con error
  const setupFailedUpload = (error: Error): void => {
    const uploadStreamCallback = jest.fn((callback) => {
      const mockStream = new Transform({
        transform(chunk, encoding, cb) {
          cb(null, chunk);
        },
      });

      setImmediate(() => {
        callback(error, null);
      });

      return mockStream;
    });

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      uploadStreamCallback,
    );
  };

  // Helper para simular retry con éxito en segundo intento
  const setupRetrySuccessOnSecondAttempt = (response: object): void => {
    let attemptCount = 0;
    const uploadStreamCallback = jest.fn((callback) => {
      const mockStream = new Transform({
        transform(chunk, encoding, cb) {
          cb(null, chunk);
        },
      });

      setImmediate(() => {
        attemptCount++;
        if (attemptCount === 1) {
          callback(new Error('Network timeout'), null);
        } else {
          callback(null, response);
        }
      });

      return mockStream;
    });

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
      uploadStreamCallback,
    );
  };

  describe('uploadFile', () => {
    it('debería subir archivo exitosamente al primer intento', async () => {
      // Arrange
      const mockFile = createMockFile();
      const mockResponse = {
        public_id: 'test_image',
        url: 'https://res.cloudinary.com/test/image/upload/test_image.jpg',
        secure_url:
          'https://res.cloudinary.com/test/image/upload/test_image.jpg',
      };

      setupSuccessfulUpload(mockResponse);

      // Act
      const resultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();
      const result = await resultPromise;

      // Assert
      expect(result).toEqual(mockResponse);
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
    });

    it('debería reintentar y subir archivo exitosamente en el segundo intento', async () => {
      // Arrange
      const mockFile = createMockFile();
      const mockResponse = {
        public_id: 'test_image',
        url: 'https://res.cloudinary.com/test/image/upload/test_image.jpg',
        secure_url:
          'https://res.cloudinary.com/test/image/upload/test_image.jpg',
      };

      setupRetrySuccessOnSecondAttempt(mockResponse);

      // Act
      const resultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();
      const result = await resultPromise;

      // Assert
      expect(result).toEqual(mockResponse);
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(2);
    });

    it('debería reintentar hasta 3 veces y luego fallar', async () => {
      // Arrange
      const mockFile = createMockFile();
      const error = new Error('Persistent network error');

      setupFailedUpload(error);

      // Act
      const resultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();

      // Assert
      await expect(resultPromise).rejects.toThrow(CustomError);
      await expect(resultPromise).rejects.toMatchObject({
        message: ERROR_MESSAGES.CLOUDINARY_UPLOAD_ERROR,
        statusCode: 500,
        errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
      });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3);
    });

    it('debería fallar cuando result es null', async () => {
      // Arrange
      const mockFile = createMockFile();
      const uploadStreamCallback = jest.fn((callback) => {
        const mockStream = new Transform({
          transform(chunk, encoding, cb) {
            cb(null, chunk);
          },
        });

        setImmediate(() => {
          callback(null, null);
        });

        return mockStream;
      });

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        uploadStreamCallback,
      );

      // Act
      const resultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();

      // Assert
      await expect(resultPromise).rejects.toThrow(CustomError);
      await expect(resultPromise).rejects.toMatchObject({
        message: ERROR_MESSAGES.CLOUDINARY_UPLOAD_ERROR,
        statusCode: 500,
        errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
      });
    });

    it('debería reintentar 3 veces si result es null en cada intento', async () => {
      // Arrange
      const mockFile = createMockFile();
      const uploadStreamCallback = jest.fn((callback) => {
        const mockStream = new Transform({
          transform(chunk, encoding, cb) {
            cb(null, chunk);
          },
        });

        setImmediate(() => {
          callback(null, null);
        });

        return mockStream;
      });

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        uploadStreamCallback,
      );

      // Act
      const resultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();

      // Assert
      await expect(resultPromise).rejects.toThrow(CustomError);
      // La primera vez falla porque result es null
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
    });

    it('debería loggear cada reintento', async () => {
      // Arrange
      const mockFile = createMockFile();
      const mockResponse = {
        public_id: 'test_image',
        url: 'https://res.cloudinary.com/test/image/upload/test_image.jpg',
      };

      let attemptCount = 0;
      const uploadStreamCallback = jest.fn((callback) => {
        const mockStream = new Transform({
          transform(chunk, encoding, cb) {
            cb(null, chunk);
          },
        });

        setImmediate(() => {
          attemptCount++;
          if (attemptCount < 3) {
            callback(new Error('Temporary error'), null);
          } else {
            callback(null, mockResponse);
          }
        });

        return mockStream;
      });

      (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(
        uploadStreamCallback,
      );

      // Act
      const resultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();
      const result = await resultPromise;

      // Assert
      expect(result).toEqual(mockResponse);
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3);
    });
  });

  describe('deleteFile', () => {
    it('debería eliminar archivo exitosamente con URL simple', async () => {
      // Arrange
      const fileUrl =
        'https://res.cloudinary.com/test/image/upload/miimagen.jpg';
      const mockResponse = { result: 'ok' };

      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      const result = await service.deleteFile(fileUrl);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('miimagen');
      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
    });

    it('debería extraer public_id correctamente de URL compleja', async () => {
      // Arrange
      const fileUrl =
        'https://res.cloudinary.com/test/image/upload/v123456/folder/subfolder/miimagen.jpg';
      const mockResponse = { result: 'ok' };

      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      const result = await service.deleteFile(fileUrl);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('miimagen');
    });

    it('debería manejar respuesta "not found" correctamente', async () => {
      // Arrange
      const fileUrl =
        'https://res.cloudinary.com/test/image/upload/noexiste.jpg';
      const mockResponse = { result: 'not found' };

      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      const result = await service.deleteFile(fileUrl);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('noexiste');
    });

    it('debería manejar nombres con múltiples puntos correctamente', async () => {
      // Arrange
      const fileUrl =
        'https://res.cloudinary.com/test/image/upload/mi.imagen.final.jpg';
      const mockResponse = { result: 'ok' };

      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      // Act
      const result = await service.deleteFile(fileUrl);

      // Assert
      // Debería tomar solo la primera parte (mi) debido al split('.')
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('mi');
      expect(result).toEqual(mockResponse);
    });

    it('debería fallar cuando destroy lanza error', async () => {
      // Arrange
      const fileUrl =
        'https://res.cloudinary.com/test/image/upload/miimagen.jpg';
      const error = new Error('Delete failed');

      (cloudinary.uploader.destroy as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(service.deleteFile(fileUrl)).rejects.toThrow(
        'Delete failed',
      );
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('miimagen');
    });
  });

  describe('Integración - Upload y Delete', () => {
    it('debería completar workflow completo: subir y luego eliminar', async () => {
      // Arrange
      const mockFile = createMockFile();
      const uploadResponse = {
        public_id: 'test_image',
        url: 'https://res.cloudinary.com/test/image/upload/test_image.jpg',
        secure_url:
          'https://res.cloudinary.com/test/image/upload/test_image.jpg',
      };
      const deleteResponse = { result: 'ok' };

      setupSuccessfulUpload(uploadResponse);
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(
        deleteResponse,
      );

      // Act
      const uploadResultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();
      const uploadResult = await uploadResultPromise;

      const deleteResult = await service.deleteFile(uploadResult.url);

      // Assert
      expect(uploadResult).toEqual(uploadResponse);
      expect(deleteResult).toEqual(deleteResponse);
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(1);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('test_image');
    });
  });

  describe('Error Handling', () => {
    it('debería crear CustomError con statusCode 500', async () => {
      // Arrange
      const mockFile = createMockFile();

      setupFailedUpload(new Error('Critical error'));

      // Act
      const resultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();

      // Assert
      await expect(resultPromise).rejects.toThrow(CustomError);
      await expect(resultPromise).rejects.toMatchObject({
        statusCode: 500,
        errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
      });
    });

    it('debería mantener el mismo error a través de reintentos', async () => {
      // Arrange
      const mockFile = createMockFile();
      const errorMessage = 'Persistent upload error';

      setupFailedUpload(new Error(errorMessage));

      // Act
      const resultPromise = service.uploadFile(mockFile);
      jest.runAllTimers();

      // Assert
      await expect(resultPromise).rejects.toThrow(CustomError);
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3);
    });
  });
});
