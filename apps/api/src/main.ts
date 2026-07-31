import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { DecimalInterceptor } from './common/interceptors/decimal.interceptor';
import { loadConfiguration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix('api');
  // Uploads werden als Data-URL/Datei ausgeliefert, daher kein strenger CORP.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: config.corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Je Feld wird nur der erste Verstoß gemeldet, damit Formulare im
      // Frontend eine eindeutige Meldung anzeigen können.
      stopAtFirstError: true,
    }),
  );
  app.useGlobalInterceptors(new DecimalInterceptor());
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();

  if (config.nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Garagentor API')
      .setDescription(
        'Branchensoftware für Garagentor-Fachbetriebe: Kunden, Belege, Toranlagen, ' +
          'Prüfungen nach ASR A1.7, Lager, Personal und Auswertungen.',
      )
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API läuft auf http://localhost:${config.port}/api`);
  if (config.nodeEnv !== 'production') {
    logger.log(`OpenAPI-Dokumentation: http://localhost:${config.port}/api/docs`);
  }
}

void bootstrap();
