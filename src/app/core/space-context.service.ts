import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';

export interface SpaceResponse {
  id: number;
  name: string;
  maxMembers?: number;
}

/**
 * Espacio activo.
 *
 * Sustituye al identificador cableado en environment: aunque de momento solo
 * haya uno, el backend permite pertenecer a varios y toda la API cuelga de
 * /api/spaces/{id}. Resolverlo aquí evita tener que tocar cada servicio el día
 * que compartáis una lista con alguien más.
 */
@Injectable({ providedIn: 'root' })
export class SpaceContext {
  private readonly http = inject(HttpClient);

  private readonly spaces = signal<SpaceResponse[]>([]);
  private readonly activeId = signal<number | null>(null);

  readonly available = this.spaces.asReadonly();
  readonly active = computed(() =>
    this.spaces().find((space) => space.id === this.activeId()) ?? null,
  );

  /**
   * @throws si no hay ningún espacio. Es un estado imposible con el alta por
   *         invitación, así que fallar es mejor que seguir con id nulo y
   *         soltar 404 por toda la aplicación.
   */
  async load(): Promise<void> {
    const spaces = await firstValueFrom(
      this.http.get<SpaceResponse[]>(`${environment.apiUrl}/api/spaces`),
    );
    if (spaces.length === 0) {
      throw new Error('La cuenta no pertenece a ningún espacio');
    }
    this.spaces.set(spaces);
    this.activeId.set(spaces[0].id);
  }

  requireId(): number {
    const id = this.activeId();
    if (id === null) {
      throw new Error('Espacio no cargado todavía');
    }
    return id;
  }

  switchTo(spaceId: number): void {
    this.activeId.set(spaceId);
  }

  clear(): void {
    this.spaces.set([]);
    this.activeId.set(null);
  }
}
