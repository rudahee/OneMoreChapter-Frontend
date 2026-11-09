import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import { WorkCandidateResponse, WorkType } from '@core/api.types';

@Injectable({ providedIn: 'root' })
export class MetadataApi {
  private readonly http = inject(HttpClient);

  /**
   * Busca en los proveedores externos. Puede tardar segundos: el backend
   * consulta varios en paralelo con un techo de 6 s, así que conviene un
   * indicador de carga y no bloquear la pantalla.
   */
  search(query: string, type: WorkType = 'OTHER'): Promise<WorkCandidateResponse[]> {
    const params = new HttpParams().set('query', query).set('type', type);
    return firstValueFrom(
      this.http.get<WorkCandidateResponse[]>(`${environment.apiUrl}/api/metadata/search`, {
        params,
      }),
    );
  }
}
