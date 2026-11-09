import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import { CurrentUserResponse, TokenResponse } from './api.types';
import { SpaceContext } from './space-context.service';
import { TokenStorage } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorage);
  private readonly router = inject(Router);
  private readonly spaces = inject(SpaceContext);

  private readonly currentUser = signal<CurrentUserResponse | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /**
   * Se llama al arrancar. Restaura el token y comprueba que sigue valiendo
   * pidiendo /me: si el refresh caducó con la app cerrada, mejor enterarse
   * aquí que con un 401 en mitad de la primera pantalla.
   */
  async bootstrap(): Promise<void> {
    await this.tokens.restore();
    if (!this.tokens.getAccessToken()) {
      return;
    }
    try {
      await this.loadCurrentUser();
    } catch {
      await this.logout();
    }
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${environment.apiUrl}/api/auth/login`, { email, password }),
    );
    await this.tokens.save(response.accessToken, response.refreshToken);
    await this.loadCurrentUser();
  }

  /** Canjear una invitación crea la cuenta y ya devuelve sesión iniciada. */
  async acceptInvitation(
    code: string,
    email: string,
    password: string,
    displayName: string,
  ): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<{ tokens: TokenResponse }>(
        `${environment.apiUrl}/api/invitations/${encodeURIComponent(code)}/accept`,
        { email, password, displayName },
      ),
    );
    await this.tokens.save(response.tokens.accessToken, response.tokens.refreshToken);
    await this.loadCurrentUser();
  }

  /**
   * Rota el par de tokens. Lo usa el interceptor ante un 401.
   * @returns el nuevo access token, o null si el refresh ya no vale
   */
  async refresh(): Promise<string | null> {
    const refreshToken = await this.tokens.getRefreshToken();
    if (!refreshToken) {
      return null;
    }
    try {
      const response = await firstValueFrom(
        this.http.post<TokenResponse>(`${environment.apiUrl}/api/auth/refresh`, { refreshToken }),
      );
      await this.tokens.save(response.accessToken, response.refreshToken);
      return response.accessToken;
    } catch {
      // El backend invalida la familia entera si detecta reutilización, así
      // que un fallo aquí puede significar sesión comprometida. En cualquier
      // caso no hay vuelta atrás: toca entrar de nuevo.
      return null;
    }
  }

  /** Cambiar la contrasenya revoca todas las sesiones, incluida la actual. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/api/auth/password`, {
        currentPassword,
        newPassword,
      }),
    );
  }

  async logout(): Promise<void> {
    const refreshToken = await this.tokens.getRefreshToken();
    if (refreshToken) {
      // Sin await: cerrar sesión en local no puede depender de que el
      // servidor conteste.
      firstValueFrom(
        this.http.post(`${environment.apiUrl}/api/auth/logout`, { refreshToken }),
      ).catch(() => undefined);
    }
    await this.tokens.clear();
    this.spaces.clear();
    this.currentUser.set(null);
    await this.router.navigate(['/login']);
  }

  private async loadCurrentUser(): Promise<void> {
    const user = await firstValueFrom(
      this.http.get<CurrentUserResponse>(`${environment.apiUrl}/api/auth/me`),
    );
    // Los espacios antes de marcar la sesión como activa: el resto de la
    // aplicación asume que hay uno resuelto en cuanto isAuthenticated() es true.
    await this.spaces.load();
    this.currentUser.set(user);
  }
}
