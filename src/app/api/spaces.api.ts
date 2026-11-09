import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import {
  CreatedInvitationResponse,
  InvitationResponse,
  SpaceMemberResponse,
} from '@core/api.types';
import { SpaceContext } from '@core/space-context.service';

@Injectable({ providedIn: 'root' })
export class SpacesApi {
  private readonly http = inject(HttpClient);
  private readonly spaces = inject(SpaceContext);

  private get base(): string {
    return `${environment.apiUrl}/api/spaces/${this.spaces.requireId()}`;
  }

  members(): Promise<SpaceMemberResponse[]> {
    return firstValueFrom(this.http.get<SpaceMemberResponse[]>(`${this.base}/members`));
  }

  /** Solo el propietario puede. Devuelve 403 al resto. */
  createInvitation(ttlHours = 72): Promise<CreatedInvitationResponse> {
    return firstValueFrom(
      this.http.post<CreatedInvitationResponse>(`${this.base}/invitations`, { ttlHours }),
    );
  }

  pendingInvitations(): Promise<InvitationResponse[]> {
    return firstValueFrom(this.http.get<InvitationResponse[]>(`${this.base}/invitations`));
  }

  revokeInvitation(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/invitations/${id}`));
  }
}
