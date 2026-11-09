import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpacesApi } from '@api/spaces.api';
import { CreatedInvitationResponse, InvitationResponse, SpaceMemberResponse } from '@core/api.types';
import { AuthService } from '@core/auth.service';
import { SpaceContext } from '@core/space-context.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <h1>Ajustes</h1>

    @if (auth.user(); as usuario) {
      <section>
        <h2>Cuenta</h2>
        <p>{{ usuario.displayName }} · <span class="muted">{{ usuario.email }}</span></p>
        <button (click)="auth.logout()">Cerrar sesión</button>
      </section>
    }

    <section>
      <h2>Cambiar contraseña</h2>
      <form (submit)="cambiarPassword($event)">
        <input type="password" name="actual" placeholder="Contraseña actual"
               autocomplete="current-password"
               [ngModel]="passwordActual()" (ngModelChange)="passwordActual.set($event)" />
        <input type="password" name="nueva" placeholder="Nueva (mínimo 12)"
               autocomplete="new-password"
               [ngModel]="passwordNueva()" (ngModelChange)="passwordNueva.set($event)" />
        <button type="submit" [disabled]="passwordNueva().length < 12">Cambiar</button>
      </form>
      <p class="muted">
        Cambiarla cierra la sesión en todos los dispositivos, incluido este.
      </p>
      @if (mensajePassword()) {
        <p class="muted">{{ mensajePassword() }}</p>
      }
    </section>

    <section>
      <h2>{{ spaces.active()?.name }}</h2>
      <ul>
        @for (miembro of miembros(); track miembro.userId) {
          <li>{{ miembro.displayName }} <span class="muted">· {{ miembro.role }}</span></li>
        }
      </ul>
    </section>

    <section>
      <h2>Invitaciones</h2>

      @if (codigoNuevo(); as invitacion) {
        <div class="codigo">
          <strong>{{ invitacion.code }}</strong>
          <p class="muted">
            Apúntalo ahora: no se puede volver a ver. Comparte el enlace
            {{ enlaceInvitacion(invitacion) }}
          </p>
          <button (click)="copiar(invitacion)">Copiar enlace</button>
        </div>
      }

      <button class="primary" (click)="crearInvitacion()" [disabled]="creando()">
        {{ creando() ? 'Creando…' : 'Crear invitación' }}
      </button>

      @if (pendientes().length > 0) {
        <ul>
          @for (invitacion of pendientes(); track invitacion.id) {
            <li>
              Creada por {{ invitacion.createdByDisplayName }}
              <span class="muted">· caduca {{ invitacion.expiresAt | date:'short' }}</span>
              <button (click)="revocar(invitacion.id)">Revocar</button>
            </li>
          }
        </ul>
      }

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    section { margin-bottom: 2.5rem; }
    form { display: grid; gap: 0.75rem; max-width: 380px; }
    ul { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
    li { display: flex; align-items: center; gap: 0.75rem; }
    .codigo {
      border: 1px solid var(--accent); border-radius: 8px;
      padding: 1rem; margin-bottom: 1rem;
    }
    .codigo strong { font-family: ui-monospace, monospace; font-size: 1.25rem; letter-spacing: 0.1em; }
  `,
})
export class SettingsComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly spaces = inject(SpaceContext);
  private readonly api = inject(SpacesApi);

  protected readonly miembros = signal<SpaceMemberResponse[]>([]);
  protected readonly pendientes = signal<InvitationResponse[]>([]);
  protected readonly codigoNuevo = signal<CreatedInvitationResponse | null>(null);
  protected readonly creando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly passwordActual = signal('');
  protected readonly passwordNueva = signal('');
  protected readonly mensajePassword = signal<string | null>(null);

  ngOnInit(): void {
    void this.cargar();
  }

  protected enlaceInvitacion(invitacion: CreatedInvitationResponse): string {
    return `${window.location.origin}/invite/${invitacion.code}`;
  }

  protected async crearInvitacion(): Promise<void> {
    this.creando.set(true);
    this.error.set(null);
    try {
      this.codigoNuevo.set(await this.api.createInvitation());
      await this.cargar();
    } catch {
      // Solo el propietario puede invitar; al resto el backend devuelve 403.
      this.error.set('No se pudo crear. ¿Eres propietario del espacio?');
    } finally {
      this.creando.set(false);
    }
  }

  protected async copiar(invitacion: CreatedInvitationResponse): Promise<void> {
    await navigator.clipboard.writeText(this.enlaceInvitacion(invitacion));
  }

  protected async revocar(id: number): Promise<void> {
    await this.api.revokeInvitation(id);
    await this.cargar();
  }

  protected async cambiarPassword(evento: Event): Promise<void> {
    evento.preventDefault();
    this.mensajePassword.set(null);
    try {
      await this.auth.changePassword(this.passwordActual(), this.passwordNueva());
      this.mensajePassword.set('Cambiada. Vuelve a entrar.');
      // El backend revoca todas las sesiones, así que la actual ya no vale.
      setTimeout(() => void this.auth.logout(), 1500);
    } catch {
      this.mensajePassword.set('La contraseña actual no es correcta.');
    }
  }

  private async cargar(): Promise<void> {
    const [miembros, pendientes] = await Promise.all([
      this.api.members(),
      this.api.pendingInvitations(),
    ]);
    this.miembros.set(miembros);
    this.pendientes.set(pendientes);
  }
}
