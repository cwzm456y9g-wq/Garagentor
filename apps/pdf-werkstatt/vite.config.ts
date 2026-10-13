import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Relative Pfade, damit der Bau auch in einem Unterordner läuft.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['tests/**/*.spec.ts'] },
});
