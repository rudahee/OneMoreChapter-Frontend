import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { authInterceptor } from '@core/auth.interceptor';
import { AuthService } from '@core/auth.service';
import { InstallService } from '@core/install.service';
import { OfflineQueue } from '@core/offline-queue.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless es el modo por defecto en Angular 22, pero se declara para que
    // quede explícito: nada de este código depende de Zone.js.
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),

    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // No al arrancar: registrarlo de inmediato compite por ancho de banda
      // con la primera carga de datos.
      registrationStrategy: 'registerWhenStable:30000',
    }),

    // El orden importa: primero la sesión, porque la cola offline puede
    // disparar peticiones que necesitan el token.
    provideAppInitializer(() => {
      // Todos los inject() ANTES del primer await. El contexto de inyección
      // solo existe durante la ejecución síncrona de la factoría: en cuanto
      // se cede el control, inject() lanza NG0203.
      const auth = inject(AuthService);
      const queue = inject(OfflineQueue);
      const install = inject(InstallService);

      // El orden sí importa: primero la sesión, porque la cola offline puede
      // disparar peticiones que necesitan el token.
      return (async () => {
        await auth.bootstrap();
        await queue.init();
        install.init();
      })();
    }),
  ],
};
