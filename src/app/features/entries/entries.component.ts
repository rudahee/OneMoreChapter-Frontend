import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EntriesApi } from '@api/entries.api';
import { EntryStatus, EntrySummaryResponse } from '@core/api.types';
import { RealtimeService } from '@core/realtime.service';

@Component({
  selector: 'app-entries',
  imports: [RouterLink],
  template: `
    <header>
      <h1>Nuestras listas</h1>
      <div class="acciones">
        <button (click)="surprise()">Sorpréndeme</button>
        <button class="primary" routerLink="/search">Añadir</button>
      </div>
    </header>

    <nav>
      @for (option of filters; track option.value) {
        <button [class.primary]="status() === option.value"
                (click)="setStatus(option.value)">
          {{ option.label }}
        </button>
      }
    </nav>

    @if (loading()) {
      <p class="muted">Cargando…</p>
    } @else if (entries().length === 0) {
      <p class="muted">Nada por aquí todavía.</p>
    } @else {
      <ul>
        @for (entry of entries(); track entry.id) {
          <li>
            <a [routerLink]="['/entries', entry.id]">
              @if (entry.work.coverUrl) {
                <!-- loading lazy: un listado largo con treinta portadas
                     satura la red del móvil si se piden todas de golpe. -->
                <img [src]="entry.work.coverUrl" [alt]="entry.work.title"
                     loading="lazy" width="60" height="90" />
              }
              <div>
                <strong>{{ entry.work.title }}</strong>
                <span class="muted">
                  {{ entry.work.type }}
                  @if (entry.work.year) { · {{ entry.work.year }} }
                </span>
              </div>
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .acciones { display: flex; gap: 0.5rem; }
    nav { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; }
    ul { list-style: none; padding: 0; display: grid; gap: 0.75rem; }
    a { display: flex; gap: 0.75rem; align-items: center; color: inherit; text-decoration: none; }
    img { border-radius: 6px; object-fit: cover; background: var(--surface); }
    div { display: grid; gap: 0.2rem; }
  `,
})
export class EntriesComponent implements OnInit {
  private readonly api = inject(EntriesApi);
  private readonly realtime = inject(RealtimeService);

  protected readonly entries = signal<EntrySummaryResponse[]>([]);
  protected readonly loading = signal(true);
  protected readonly status = signal<EntryStatus | undefined>(undefined);

  protected readonly filters: { label: string; value: EntryStatus | undefined }[] = [
    { label: 'Todo', value: undefined },
    { label: 'Viendo', value: 'IN_PROGRESS' },
    { label: 'Pendiente', value: 'BACKLOG' },
    { label: 'Terminado', value: 'DONE' },
  ];

  constructor() {
    // Cualquier cambio hecho desde el otro móvil recarga la lista. Se filtran
    // los eventos de nota y valoración: no afectan a lo que se ve aquí.
    effect(() => {
      const event = this.realtime.lastEvent();
      if (event && event.type !== 'NOTE_CHANGED' && event.type !== 'RATING_CHANGED') {
        void this.load();
      }
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  protected setStatus(status: EntryStatus | undefined): void {
    this.status.set(status);
    void this.load();
  }

  protected async surprise(): Promise<void> {
    this.entries.set(await this.api.pick(3));
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.api.list({ status: this.status() });
      this.entries.set(page.content);
    } finally {
      this.loading.set(false);
    }
  }
}
