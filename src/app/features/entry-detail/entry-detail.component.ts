import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EntriesApi } from '@api/entries.api';
import { FeedbackApi } from '@api/feedback.api';
import { EntryResponse, NoteResponse } from '@core/api.types';
import { AuthService } from '@core/auth.service';
import { RealtimeService } from '@core/realtime.service';

@Component({
  selector: 'app-entry-detail',
  imports: [FormsModule, DatePipe],
  template: `
    @if (entrada(); as e) {
      <header>
        @if (e.work.coverUrl) {
          <img [src]="e.work.coverUrl" [alt]="e.work.title" width="90" height="135" />
        }
        <div>
          <h1>{{ e.work.title }}</h1>
          <p class="muted">
            {{ e.work.type }}
            @if (e.work.year) { · {{ e.work.year }} }
            · {{ e.status }}
          </p>
        </div>
      </header>

      @if (e.work.episodic) {
        <section>
          <p>
            {{ e.progress.seenCount }} / {{ e.progress.totalUnits ?? '?' }}
            @if (e.progress.percentage !== undefined) { ({{ e.progress.percentage }} %) }
          </p>

          <button class="primary" [disabled]="e.progress.complete || avanzando()"
                  (click)="avanzar()">
            {{ e.progress.complete ? 'Terminado' : 'Un capítulo más' }}
          </button>

          @if (avisoOffline()) {
            <p class="muted">Sin conexión. Se enviará al reconectar.</p>
          }

          <button (click)="verTodos.set(!verTodos())">
            {{ verTodos() ? 'Ocultar' : 'Ver' }} episodios
          </button>

          @if (verTodos()) {
            <ul class="unidades">
              @for (unidad of e.work.units; track unidad.id) {
                <li [class.visto]="vistos().has(unidad.id)">
                  <span>
                    @if (unidad.seasonNumber) { T{{ unidad.seasonNumber }} }
                    E{{ unidad.unitNumber }}
                    @if (unidad.title) { — {{ unidad.title }} }
                  </span>
                  @if (!vistos().has(unidad.id)) {
                    <button (click)="marcarHasta(unidad.id)">Hasta aquí</button>
                  }
                </li>
              }
            </ul>
          }
        </section>
      }

      <section>
        <h2>Notas</h2>
        @for (valoracion of e.ratings; track valoracion.userId) {
          <p><strong>{{ valoracion.displayName }}</strong>: {{ valoracion.score }}/10
            @if (valoracion.review) { <span class="muted">— {{ valoracion.review }}</span> }
          </p>
        }

        <form (submit)="valorar($event)">
          <select name="score" [ngModel]="nota()" (ngModelChange)="nota.set(+$event)">
            @for (n of notasPosibles; track n) {
              <option [value]="n">{{ n }}</option>
            }
          </select>
          <input type="text" name="review" placeholder="Comentario (opcional)"
                 [ngModel]="comentario()" (ngModelChange)="comentario.set($event)" />
          <button type="submit">Puntuar</button>
        </form>
      </section>

      <section>
        <h2>Comentarios</h2>

        <form (submit)="anadirNota($event)">
          <input type="text" name="nota" placeholder="Comentar algo…"
                 [ngModel]="textoNota()" (ngModelChange)="textoNota.set($event)" />
          <button type="submit" [disabled]="textoNota().trim().length === 0">Añadir</button>
        </form>

        @for (nota of notas(); track nota.id) {
          <article>
            <p>{{ nota.body }}</p>
            <p class="muted">
              {{ nota.authorDisplayName }}
              @if (nota.unitLabel) { · {{ nota.unitLabel }} }
              · {{ nota.createdAt | date:'short' }}
              @if (esMia(nota)) {
                <button (click)="borrarNota(nota.id)">Borrar</button>
              }
            </p>
          </article>
        }
      </section>
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
  styles: `
    :host { display: block; }
    header { display: flex; gap: 1rem; align-items: flex-start; }
    header img { border-radius: 6px; object-fit: cover; background: var(--surface); }
    h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
    section { margin: 2rem 0; }
    form { display: flex; gap: 0.5rem; margin: 1rem 0; }
    select { width: auto; }
    .unidades { list-style: none; padding: 0; display: grid; gap: 0.4rem; margin-top: 1rem; }
    .unidades li { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .unidades li.visto { color: var(--muted); text-decoration: line-through; }
    article { border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.75rem; }
    article p { margin: 0 0 0.25rem; }
  `,
})
export class EntryDetailComponent implements OnInit {
  /** Llega de la ruta gracias a withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly api = inject(EntriesApi);
  private readonly feedback = inject(FeedbackApi);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);

  protected readonly entrada = signal<EntryResponse | null>(null);
  protected readonly notas = signal<NoteResponse[]>([]);
  protected readonly avanzando = signal(false);
  protected readonly avisoOffline = signal(false);
  protected readonly verTodos = signal(false);
  protected readonly nota = signal(7);
  protected readonly comentario = signal('');
  protected readonly textoNota = signal('');

  protected readonly notasPosibles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  /** Set en vez de includes: el listado de un manga puede tener cientos de ids. */
  protected readonly vistos = computed(
    () => new Set(this.entrada()?.seenUnitIds ?? []),
  );

  constructor() {
    // Solo recarga si el evento es de ESTA entrada. El eco de nuestras propias
    // acciones también entra, pero recargar es barato y evita divergencias.
    effect(() => {
      const evento = this.realtime.lastEvent();
      if (evento?.entryId === Number(this.id())) {
        void this.cargar();
      }
    });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  protected esMia(nota: NoteResponse): boolean {
    return nota.authorId === this.auth.user()?.id;
  }

  protected async avanzar(): Promise<void> {
    this.avanzando.set(true);
    try {
      const progreso = await this.api.advance(Number(this.id()));
      if (progreso === null) {
        this.avisoOffline.set(true);
        return;
      }
      await this.cargar();
    } finally {
      this.avanzando.set(false);
    }
  }

  protected async marcarHasta(unitId: number): Promise<void> {
    const progreso = await this.api.markUpTo(Number(this.id()), unitId);
    if (progreso === null) {
      this.avisoOffline.set(true);
      return;
    }
    await this.cargar();
  }

  protected async valorar(evento: Event): Promise<void> {
    evento.preventDefault();
    await this.feedback.rate(
      Number(this.id()), this.nota(), this.comentario().trim() || undefined,
    );
    this.comentario.set('');
    await this.cargar();
  }

  protected async anadirNota(evento: Event): Promise<void> {
    evento.preventDefault();
    const texto = this.textoNota().trim();
    if (texto.length === 0) {
      return;
    }
    await this.feedback.addNote(Number(this.id()), texto);
    this.textoNota.set('');
    this.notas.set(await this.feedback.notes(Number(this.id())));
  }

  protected async borrarNota(noteId: number): Promise<void> {
    await this.feedback.deleteNote(Number(this.id()), noteId);
    this.notas.set(await this.feedback.notes(Number(this.id())));
  }

  private async cargar(): Promise<void> {
    const entryId = Number(this.id());
    const [entrada, notas] = await Promise.all([
      this.api.get(entryId),
      this.feedback.notes(entryId),
    ]);
    this.entrada.set(entrada);
    this.notas.set(notas);
  }
}
