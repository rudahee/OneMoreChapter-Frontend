import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';

interface QueuedMutation {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  queuedAt: number;
}

/**
 * Cola de operaciones pendientes para cuando no hay red.
 *
 * El caso concreto: marcáis un episodio en el metro sin cobertura. La marca se
 * aplica en local, la petición se guarda y se envía al reconectar.
 *
 * Solo encola mutaciones idempotentes. Marcar un episodio ya marcado el
 * backend lo ignora en silencio, así que reenviar es seguro. NO metas aquí
 * nada que cree recursos: si la respuesta se perdió pero el servidor sí la
 * procesó, el reenvío duplicaría.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueue {
  private static readonly KEY = 'pending_mutations';
  private static readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  private readonly http = inject(HttpClient);
  private readonly pendingCount = signal(0);
  private draining = false;

  readonly pending = this.pendingCount.asReadonly();

  async init(): Promise<void> {
    this.pendingCount.set((await this.read()).length);

    Network.addListener('networkStatusChange', (status) => {
      if (status.connected) {
        void this.drain();
      }
    });

    if ((await Network.getStatus()).connected) {
      void this.drain();
    }
  }

  async isOnline(): Promise<boolean> {
    return (await Network.getStatus()).connected;
  }

  async enqueue(mutation: Omit<QueuedMutation, 'id' | 'queuedAt'>): Promise<void> {
    const queue = await this.read();
    queue.push({ ...mutation, id: crypto.randomUUID(), queuedAt: Date.now() });
    await this.write(queue);
  }

  /**
   * Vacía la cola en orden. Se para al primer fallo de red para no perder el
   * orden de las operaciones: si el episodio 4 falla, el 5 no debe adelantarlo.
   */
  async drain(): Promise<void> {
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      let queue = await this.read();

      while (queue.length > 0) {
        const [next, ...rest] = queue;

        // Lo muy viejo se descarta: probablemente el estado ya cambió por
        // otro camino y reenviarlo pisaría algo más reciente.
        if (Date.now() - next.queuedAt > OfflineQueue.MAX_AGE_MS) {
          queue = rest;
          await this.write(queue);
          continue;
        }

        try {
          await this.send(next);
          queue = rest;
          await this.write(queue);
        } catch (error) {
          if (this.isClientError(error)) {
            // 4xx significa que la petición no valía; reintentarla no la va a
            // arreglar. Se descarta para no bloquear la cola para siempre.
            queue = rest;
            await this.write(queue);
            continue;
          }
          break; // fallo de red: se reintenta al reconectar
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async send(mutation: QueuedMutation): Promise<void> {
    const url = `${environment.apiUrl}${mutation.path}`;
    const request = {
      POST: () => this.http.post(url, mutation.body ?? {}),
      PUT: () => this.http.put(url, mutation.body ?? {}),
      PATCH: () => this.http.patch(url, mutation.body ?? {}),
      DELETE: () => this.http.delete(url, { body: mutation.body }),
    }[mutation.method];

    await firstValueFrom(request());
  }

  private isClientError(error: unknown): boolean {
    const status = (error as { status?: number })?.status;
    return typeof status === 'number' && status >= 400 && status < 500;
  }

  private async read(): Promise<QueuedMutation[]> {
    const { value } = await Preferences.get({ key: OfflineQueue.KEY });
    return value ? (JSON.parse(value) as QueuedMutation[]) : [];
  }

  private async write(queue: QueuedMutation[]): Promise<void> {
    await Preferences.set({ key: OfflineQueue.KEY, value: JSON.stringify(queue) });
    this.pendingCount.set(queue.length);
  }
}
