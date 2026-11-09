import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import {
  EntryResponse,
  EntrySummaryResponse,
  EntryStatus,
  PageResponse,
  ProgressResponse,
  WorkType,
} from '@core/api.types';
import { OfflineQueue } from '@core/offline-queue.service';
import { SpaceContext } from '@core/space-context.service';

@Injectable({ providedIn: 'root' })
export class EntriesApi {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueue);
  private readonly spaces = inject(SpaceContext);

  /** Getter y no campo: el espacio se resuelve al arrancar, no al construir. */
  private get base(): string {
    return `${environment.apiUrl}/api/spaces/${this.spaces.requireId()}/entries`;
  }

  private path(suffix: string): string {
    return `/api/spaces/${this.spaces.requireId()}/entries${suffix}`;
  }

  list(filters: {
    status?: EntryStatus;
    type?: WorkType;
    tagId?: number;
    page?: number;
  } = {}): Promise<PageResponse<EntrySummaryResponse>> {
    let params = new HttpParams().set('size', 30).set('page', filters.page ?? 0);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.tagId) params = params.set('tagId', filters.tagId);

    return firstValueFrom(
      this.http.get<PageResponse<EntrySummaryResponse>>(this.base, { params }),
    );
  }

  get(entryId: number): Promise<EntryResponse> {
    return firstValueFrom(this.http.get<EntryResponse>(`${this.base}/${entryId}`));
  }

  addFromProvider(source: string, externalId: string, type: WorkType): Promise<EntrySummaryResponse> {
    return firstValueFrom(
      this.http.post<EntrySummaryResponse>(this.base, { source, externalId, type }),
    );
  }

  changeStatus(entryId: number, status: EntryStatus): Promise<EntrySummaryResponse> {
    return firstValueFrom(
      this.http.patch<EntrySummaryResponse>(`${this.base}/${entryId}`, { status }),
    );
  }

  /**
   * Marca la siguiente unidad sin ver.
   *
   * Si no hay red, se encola y se devuelve null: la interfaz ya aplicó el
   * cambio de forma optimista. Es idempotente, así que reenviarlo al
   * reconectar no rompe nada aunque el otro móvil ya lo hubiera marcado.
   */
  async advance(entryId: number): Promise<ProgressResponse | null> {
    const path = this.path(`/${entryId}/progress/advance`);

    if (!(await this.queue.isOnline())) {
      await this.queue.enqueue({ method: 'POST', path });
      return null;
    }
    return firstValueFrom(this.http.post<ProgressResponse>(`${environment.apiUrl}${path}`, {}));
  }

  async markUpTo(entryId: number, unitId: number): Promise<ProgressResponse | null> {
    const path = this.path(`/${entryId}/progress/seen`);
    const body = { upToUnitId: unitId };

    if (!(await this.queue.isOnline())) {
      await this.queue.enqueue({ method: 'POST', path, body });
      return null;
    }
    return firstValueFrom(
      this.http.post<ProgressResponse>(`${environment.apiUrl}${path}`, body),
    );
  }

  rate(entryId: number, score: number, review?: string): Promise<unknown> {
    return firstValueFrom(
      this.http.put(`${this.base}/${entryId}/rating`, { score, review }),
    );
  }

  pick(count = 1): Promise<EntrySummaryResponse[]> {
    return firstValueFrom(
      this.http.post<EntrySummaryResponse[]>(
        `${environment.apiUrl}/api/spaces/${this.spaces.requireId()}/picker`,
        { count },
      ),
    );
  }
}
