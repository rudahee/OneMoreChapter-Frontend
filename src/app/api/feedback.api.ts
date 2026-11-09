import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import { NoteResponse, RatingResponse } from '@core/api.types';
import { SpaceContext } from '@core/space-context.service';

@Injectable({ providedIn: 'root' })
export class FeedbackApi {
  private readonly http = inject(HttpClient);
  private readonly spaces = inject(SpaceContext);

  private base(entryId: number): string {
    return `${environment.apiUrl}/api/spaces/${this.spaces.requireId()}/entries/${entryId}`;
  }

  /** PUT y no POST: cada persona tiene una sola nota y volver a puntuar la sustituye. */
  rate(entryId: number, score: number, review?: string): Promise<RatingResponse> {
    return firstValueFrom(
      this.http.put<RatingResponse>(`${this.base(entryId)}/rating`, { score, review }),
    );
  }

  /** @param unitId filtra por unidad; sin él trae todas, que en un manga largo son muchas. */
  notes(entryId: number, unitId?: number): Promise<NoteResponse[]> {
    let params = new HttpParams();
    if (unitId) {
      params = params.set('unitId', unitId);
    }
    return firstValueFrom(
      this.http.get<NoteResponse[]>(`${this.base(entryId)}/notes`, { params }),
    );
  }

  addNote(entryId: number, body: string, unitId?: number): Promise<NoteResponse> {
    return firstValueFrom(
      this.http.post<NoteResponse>(`${this.base(entryId)}/notes`, { body, unitId }),
    );
  }

  /** Solo el autor puede. El backend devuelve 403 si es de la otra persona. */
  deleteNote(entryId: number, noteId: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base(entryId)}/notes/${noteId}`),
    );
  }
}
