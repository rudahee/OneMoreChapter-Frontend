import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Client } from '@stomp/stompjs';
import { environment } from '@env';
import { SpaceContext } from './space-context.service';
import { TokenStorage } from './token-storage.service';

export type SpaceChangeType =
  | 'ENTRY_ADDED'
  | 'ENTRY_UPDATED'
  | 'ENTRY_REMOVED'
  | 'PROGRESS_CHANGED'
  | 'RATING_CHANGED'
  | 'NOTE_CHANGED'
  | 'TAGS_CHANGED';

export interface SpaceEventMessage {
  type: SpaceChangeType;
  entryId?: number;
  actorUserId?: number;
  version?: number;
  occurredAt: string;
}

/**
 * Sincronización con el otro dispositivo.
 *
 * El servidor manda avisos, no datos: al recibir uno se recarga el recurso
 * afectado. Menos eficiente que aplicar deltas, pero se corrige solo si dos
 * mensajes llegan desordenados o si el socket estuvo caído un rato.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly tokens = inject(TokenStorage);
  private readonly spaces = inject(SpaceContext);
  private client: Client | null = null;

  /** Último evento recibido. Los componentes lo observan con un effect. */
  private readonly lastEventSignal = signal<SpaceEventMessage | null>(null);
  private readonly connectedSignal = signal(false);

  readonly lastEvent = this.lastEventSignal.asReadonly();
  readonly connected = this.connectedSignal.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  connect(spaceId: number = this.spaces.requireId()): void {
    if (this.client?.active) {
      return;
    }
    const token = this.tokens.getAccessToken();
    if (!token) {
      return;
    }

    this.client = new Client({
      brokerURL: `${environment.apiUrl.replace(/^http/, 'ws')}/ws`,

      // El token va en el frame CONNECT, no en la URL: los query params
      // acaban en los logs del proxy y en el historial del navegador.
      connectHeaders: { Authorization: `Bearer ${token}` },

      // Deben coincidir con el latido del servidor (10 s en WebSocketConfig).
      // Sin latido, una conexión móvil que muere al cambiar de red se queda
      // colgada hasta el timeout del sistema operativo.
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      reconnectDelay: 5_000,

      onConnect: () => {
        this.connectedSignal.set(true);
        this.client?.subscribe(`/topic/spaces/${spaceId}`, (message) => {
          this.lastEventSignal.set(JSON.parse(message.body) as SpaceEventMessage);
        });
      },

      onDisconnect: () => this.connectedSignal.set(false),
      onWebSocketClose: () => this.connectedSignal.set(false),

      onStompError: () => {
        // El servidor rechaza CONNECT si el token caducó. Se para la
        // reconexión automática: reintentar con el mismo token es inútil.
        this.connectedSignal.set(false);
        void this.reconnectWithFreshToken(spaceId);
      },
    });

    this.client.activate();
  }

  /** Rehace la conexión tras un refresco de token. */
  private async reconnectWithFreshToken(spaceId: number): Promise<void> {
    this.disconnect();
    // Espera a que el interceptor haya renovado el token por su cuenta.
    setTimeout(() => this.connect(spaceId), 2_000);
  }

  disconnect(): void {
    void this.client?.deactivate();
    this.client = null;
    this.connectedSignal.set(false);
  }
}
