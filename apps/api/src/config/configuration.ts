/** Zentral geladene und validierte Laufzeitkonfiguration. */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  uploads: {
    dir: string;
    maxBytes: number;
  };
}

const DEV_FALLBACK_SECRET = 'dev-access-secret-bitte-ersetzen';

function requireSecret(name: string, value: string | undefined, isProduction: boolean): string {
  if (!value) {
    if (isProduction) {
      throw new Error(`${name} muss im Produktivbetrieb gesetzt sein.`);
    }
    return `${DEV_FALLBACK_SECRET}-${name}`;
  }
  if (isProduction && value.includes('bitte-ersetzen')) {
    throw new Error(`${name} enthält noch den Entwicklungswert.`);
  }
  if (isProduction && value.length < 32) {
    throw new Error(`${name} muss mindestens 32 Zeichen lang sein.`);
  }
  return value;
}

export function loadConfiguration(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  const isProduction = nodeEnv === 'production';

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL ist nicht gesetzt.');
  }

  return {
    nodeEnv,
    port: Number.parseInt(process.env.API_PORT ?? '4000', 10),
    corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    databaseUrl,
    jwt: {
      accessSecret: requireSecret('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET, isProduction),
      refreshSecret: requireSecret(
        'JWT_REFRESH_SECRET',
        process.env.JWT_REFRESH_SECRET,
        isProduction,
      ),
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    },
    uploads: {
      dir: process.env.UPLOAD_DIR ?? './uploads',
      maxBytes: Number.parseInt(process.env.MAX_UPLOAD_MB ?? '25', 10) * 1024 * 1024,
    },
  };
}
