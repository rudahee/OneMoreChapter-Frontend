import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntriesApi } from '@api/entries.api';
import { MetadataApi } from '@api/metadata.api';
import { WorkCandidateResponse, WorkType } from '@core/api.types';

@Component({
  selector: 'app-search',
  imports: [FormsModule],
  template: `
    <header>
      <button (click)="volver()">← Volver</button>
      <h1>Añadir</h1>
    </header>

    <form (submit)="buscar($event)">
      <select [ngModel]="tipo()" (ngModelChange)="tipo.set($event)" name="tipo">
        @for (opcion of tipos; track opcion.value) {
          <option [value]="opcion.value">{{ opcion.label }}</option>
        }
      </select>

      <input type="search" name="q" placeholder="Título…" autocomplete="off"
             [ngModel]="consulta()" (ngModelChange)="consulta.set($event)" />

      <button class="primary" type="submit" [disabled]="buscando()">
        {{ buscando() ? 'Buscando…' : 'Buscar' }}
      </button>
    </form>

    @if (error()) {
      <p class="error">{{ error() }}</p>
    }

    @if (buscando()) {
      <p class="muted">Consultando proveedores…</p>
    } @else if (buscado() && candidatos().length === 0) {
      <p class="muted">Nada encontrado. Prueba con el título original.</p>
    }

    <ul>
      @for (candidato of candidatos(); track candidato.source + candidato.externalId) {
        <li>
          @if (candidato.coverUrl) {
            <img [src]="candidato.coverUrl" [alt]="candidato.title"
                 loading="lazy" width="60" height="90" />
          } @else {
            <div class="sin-portada"></div>
          }

          <div class="datos">
            <strong>{{ candidato.title }}</strong>
            <span class="muted">
              {{ candidato.type }}
              @if (candidato.year) { · {{ candidato.year }} }
              · {{ candidato.source }}
            </span>
          </div>

          <button [disabled]="anadiendo() === clave(candidato)"
                  (click)="anadir(candidato)">
            {{ anadiendo() === clave(candidato) ? '…' : 'Añadir' }}
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; }
    header { display: flex; align-items: center; gap: 1rem; }
    form { display: grid; gap: 0.75rem; margin-bottom: 1.5rem; }
    select { width: auto; }
    ul { list-style: none; padding: 0; display: grid; gap: 1rem; }
    li { display: flex; gap: 0.75rem; align-items: center; }
    .datos { display: grid; gap: 0.2rem; flex: 1; min-width: 0; }
    .datos strong { overflow-wrap: anywhere; }
    img, .sin-portada {
      width: 60px; height: 90px; border-radius: 6px;
      object-fit: cover; background: var(--surface); flex-shrink: 0;
    }
  `,
})
export class SearchComponent {
  private readonly metadata = inject(MetadataApi);
  private readonly entries = inject(EntriesApi);
  private readonly router = inject(Router);

  /**
   * El tipo NO es un filtro cosmético: decide a qué proveedores pregunta el
   * backend. Con SERIES va a TVMaze (episodios reales), con MANGA a MangaDex
   * y AniList. OTHER solo llega a Wikidata, que cubre todo pero con peores
   * portadas. Elegir bien el tipo cambia por completo el resultado.
   */
  protected readonly tipos: { label: string; value: WorkType }[] = [
    { label: 'Serie', value: 'SERIES' },
    { label: 'Película', value: 'MOVIE' },
    { label: 'Anime', value: 'ANIME' },
    { label: 'Manga', value: 'MANGA' },
    { label: 'Libro', value: 'BOOK' },
    { label: 'Documental', value: 'DOCUMENTARY' },
    { label: 'Álbum', value: 'ALBUM' },
    { label: 'Pódcast', value: 'PODCAST' },
    { label: 'Otro', value: 'OTHER' },
  ];

  protected readonly tipo = signal<WorkType>('SERIES');
  protected readonly consulta = signal('');
  protected readonly candidatos = signal<WorkCandidateResponse[]>([]);
  protected readonly buscando = signal(false);
  protected readonly buscado = signal(false);
  protected readonly anadiendo = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected clave(candidato: WorkCandidateResponse): string {
    return candidato.source + candidato.externalId;
  }

  /**
   * Búsqueda explícita, no según se teclea. Cada consulta golpea APIs externas
   * con límites por IP compartidos, así que buscar en cada pulsación agotaría
   * la cuota en una tarde.
   */
  protected async buscar(evento: Event): Promise<void> {
    evento.preventDefault();

    const texto = this.consulta().trim();
    if (texto.length < 2 || this.buscando()) {
      return;
    }

    this.buscando.set(true);
    this.error.set(null);

    try {
      this.candidatos.set(await this.metadata.search(texto, this.tipo()));
      this.buscado.set(true);
    } catch {
      this.error.set('No se pudo buscar. Puede que un proveedor esté saturado.');
    } finally {
      this.buscando.set(false);
    }
  }

  /**
   * Manda solo la procedencia. El backend importa la obra al catálogo y la
   * añade a la lista en una sola llamada.
   */
  protected async anadir(candidato: WorkCandidateResponse): Promise<void> {
    this.anadiendo.set(this.clave(candidato));
    this.error.set(null);

    try {
      const entrada = await this.entries.addFromProvider(
        candidato.source, candidato.externalId, candidato.type,
      );
      await this.router.navigate(['/entries', entrada.id]);
    } catch {
      // Importar una serie larga trae cientos de episodios y puede tardar.
      this.error.set('No se pudo añadir. Inténtalo de nuevo.');
      this.anadiendo.set(null);
    }
  }

  protected volver(): void {
    void this.router.navigate(['/entries']);
  }
}
