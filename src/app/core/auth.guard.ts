import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  // Se guarda a dónde iba para volver después de entrar. Sin esto, abrir un
  // enlace directo a una ficha te deja en la lista general tras el login.
  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};
