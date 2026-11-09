import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.rudahee.uncapitulomas',
  appName: 'Un Capítulo Más',
  webDir: 'dist/uncapitulomas/browser',

  server: {
    // El WebView de Android sirve desde https://localhost por defecto. Este
    // esquema debe coincidir con los orígenes permitidos en CorsConfig del
    // backend, o la app compila y luego no puede llamar a la API.
    androidScheme: 'https',
  },

  android: {
    // Sin esto, un fallo de certificado en desarrollo es invisible: la app
    // simplemente no carga nada y no dice por qué.
    webContentsDebuggingEnabled: true,
  },
};

export default config;
