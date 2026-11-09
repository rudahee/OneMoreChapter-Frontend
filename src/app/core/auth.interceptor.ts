import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '@env';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage.service';

/**
 * Promesa de refresco en curso, compartida por todas las peticiones.
 *
 * Es lo que evita la estampida: al caducar el token, la pantalla suele tener
 * cuatro o cinco llamadas en vuelo que fallan a la vez. Sin esto, cada una
 * pediría su propio refresco, y como el backend rota el token e invalida el
 * anterior, la segunda llegaría con uno ya revocado y tumbaría la sesión
 * entera por falsa detección de reutilización.
 */
let refreshInFlight: Promise<string | null> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorage);
  const auth = inject(AuthService);

  // El refresco y el login no llevan token: adjuntarlo provocaría un bucle.
  if (isPublicEndpoint(req.url)) {
    return next(req);
  }

  const token = tokens.getAccessToken();
  const authorized = token ? withToken(req, token) : req;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !token) {
        return throwError(() => error);
      }
      return retryAfterRefresh(authorized, next, auth);
    }),
  );
};

function retryAfterRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
): Observable<HttpEvent<unknown>> {
  refreshInFlight ??= auth.refresh().finally(() => {
    // Se libera en el siguiente tick para que las peticiones que fallaron a la
    // vez encuentren la promesa ya resuelta en vez de arrancar otra ronda.
    setTimeout(() => (refreshInFlight = null), 0);
  });

  return from(refreshInFlight).pipe(
    switchMap((newToken): Observable<HttpEvent<unknown>> => {
      if (!newToken) {
        void auth.logout();
        return throwError(() => new Error('Sesión caducada'));
      }
      return next(withToken(req, newToken));
    }),
  );
}

function withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isPublicEndpoint(url: string): boolean {
  if (!url.startsWith(environment.apiUrl)) {
    return true; // llamadas a terceros: no es asunto nuestro
  }
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/invitations/') ||
    url.includes('/media/covers/')
  );
}
