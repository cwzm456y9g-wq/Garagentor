import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { RequestContextInterceptor } from './common/audit/request-context.interceptor';
import { DecimalInterceptor } from './common/interceptors/decimal.interceptor';
import { loadConfiguration } from './config/configuration';

/** Übliche Obergrenze für Anfragerümpfe. */
const STANDARD_BODY_LIMIT = '100kb';

/** Größerer Rahmen für die Einstellungen, die das Logo als Data-URL tragen. */
const LOGO_BODY_LIMIT = '1mb';

/**
 * Rahmen für Abschlüsse mit Unterschrift. Zwei handgeschriebene Züge aus dem
 * Unterschriftenfeld liegen als PNG-Data-URL typischerweise bei einigen zehn
 * Kilobyte; auf einem hochauflösenden Tablet werden es deutlich mehr.
 */
const SIGNATURE_BODY_LIMIT = '1mb';

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();
  // Der eingebaute Parser wird abgeschaltet, weil die Grenze pfadabhängig ist –
  // sonst liefen zwei Parser gegeneinander.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });

  app.setGlobalPrefix('api');

  // Die Einstellungen tragen das Firmenlogo als Data-URL und überschreiten damit
  // die üblichen 100 kB. Der größere Rahmen gilt bewusst nur für diesen Pfad;
  // die Reihenfolge zählt, der engere Parser darf erst danach greifen.
  app.use('/api/settings', json({ limit: LOGO_BODY_LIMIT }));
  app.use('/api/inspections', json({ limit: SIGNATURE_BODY_LIMIT }));
  app.use('/api/service-reports', json({ limit: SIGNATURE_BODY_LIMIT }));
  app.use(json({ limit: STANDARD_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: STANDARD_BODY_LIMIT }));
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
  app.useGlobalInterceptors(new RequestContextInterceptor(), new DecimalInterceptor());
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
