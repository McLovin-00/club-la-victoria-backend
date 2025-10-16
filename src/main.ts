import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { AppConfigService } from './config/AppConfig/app-config.service';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from './common/filters/exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  app.setGlobalPrefix('api');

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.use(helmet());
  app.use(compression()); // Enable gzip compression
  // app.use(multer)
  app.enableCors({
    origin: config.getCorsOrigin(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // elimina propiedades no declaradas en DTO
      forbidNonWhitelisted: true, // lanza error si mandan campos extras
      transform: true, // convierte automáticamente a clases/objetos
      transformOptions: {
        enableImplicitConversion: true, // permite parsear tipos básicos (string -> number)
      },
    }),
  );

  // registro global del filtro
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // Configuración de Swagger (solo en desarrollo)
  if (!config.isProduction()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Club La Victoria - API')
      .setDescription(
        'API REST para el sistema de gestión de ingresos del Club La Victoria. Permite gestionar socios, temporadas de pileta, registros de ingreso y estadísticas.',
      )
      .setVersion('1.0')
      .addTag('health', 'Health check y monitoreo del sistema')
      .addTag('auth', 'Autenticación y gestión de usuarios')
      .addTag('socios', 'Gestión de socios del club')
      .addTag('temporadas', 'Gestión de temporadas de pileta')
      .addTag('registro-ingreso', 'Registro de ingresos al club y pileta')
      .addTag('estadisticas', 'Estadísticas y métricas del sistema')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa el token JWT obtenido del login',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Club La Victoria API',
      customfavIcon: 'https://nestjs.com/img/logo-small.svg',
      customCss: '.swagger-ui .topbar { display: none }',
    });

    logger.log(
      `Swagger UI available at http://localhost:${config.getPort()}/api/docs`,
    );
  } else {
    logger.log('Swagger UI disabled in production mode');
  }

  const PORT = config.getPort() ?? 3001;

  await app.listen(PORT);
  logger.log(`Server running on port ${PORT}`);
}
void bootstrap();
