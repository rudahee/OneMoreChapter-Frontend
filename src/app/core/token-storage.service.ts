import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Custodia de los tokens.
 *
 * Capacitor Preferences usa almacenamiento nativo en Android (SharedPreferences,
 * privado a la app) y localStorage en web. O sea: en móvil está razonablemente
 * protegido, en navegador no más que cualquier otra cosa.
 *
 * Lo que compensa esa debilidad en web no es el almacén sino el diseño del
 * backend: access token de 15 minutos y refresh rotativo con detección de
 * reutilización. Un token robado sirve poco rato y su uso deja rastro.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private static readonly ACCESS = 'access_token';
  private static readonly REFRESH = 'refresh_token';

  /**
   * Copia en memoria del access token. El interceptor lo necesita de forma
   * síncrona en cada petición y Preferences es asíncrono; ir al almacén en
   * cada llamada añadiría latencia sin ganar nada.
   */
  private accessToken: string | null = null;

  async restore(): Promise<void> {
    const { value } = await Preferences.get({ key: TokenStorage.ACCESS });
    this.accessToken = value;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async getRefreshToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: TokenStorage.REFRESH });
    return value;
  }

  async save(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken;
    await Promise.all([
      Preferences.set({ key: TokenStorage.ACCESS, value: accessToken }),
      Preferences.set({ key: TokenStorage.REFRESH, value: refreshToken }),
    ]);
  }

  async clear(): Promise<void> {
    this.accessToken = null;
    await Promise.all([
      Preferences.remove({ key: TokenStorage.ACCESS }),
      Preferences.remove({ key: TokenStorage.REFRESH }),
    ]);
  }
}
