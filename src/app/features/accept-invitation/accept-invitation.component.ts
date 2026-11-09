import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth.service';

/**
 * Alta de cuenta. Es el único camino de registro: no hay formulario abierto.
 *
 * Se llega por enlace directo, /invite/ABCD1234EFGH5678, así que la ruta es
 * pública y el código llega como parámetro.
 */
@Component({
  selector: 'app-accept-invitation',
  imports: [FormsModule],
  template: `
    <h1>Te han invitado</h1>
    <p class="muted">Crea tu cuenta para entrar en el espacio compartido.</p>

    <form (submit)="aceptar($event)">
      <label>
        Nombre visible
        <input type="text" name="displayName" autocomplete="nickname" required
               [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" />
      </label>

      <label>
        Correo
        <input type="email" name="email" autocomplete="email" required
               [ngModel]="email()" (ngModelChange)="email.set($event)" />
      </label>

      <label>
        Contraseña
        <input type="password" name="password" autocomplete="new-password" required
               [ngModel]="password()" (ngModelChange)="password.set($event)" />
        <span class="muted">Mínimo 12 caracteres. Larga mejor que complicada.</span>
      </label>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <button class="primary" type="submit" [disabled]="ocupado() || !valido()">
        {{ ocupado() ? 'Creando…' : 'Crear cuenta' }}
      </button>
    </form>
  `,
  styles: `
    :host { display: block; max-width: 380px; margin: 3rem auto; }
    form { display: grid; gap: 1rem; }
    label { display: grid; gap: 0.35rem; }
  `,
})
export class AcceptInvitationComponent {
  /** Llega de la ruta gracias a withComponentInputBinding. */
  readonly code = input.required<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly nombre = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Se valida aquí lo mismo que exige el backend, para no gastar un intento. */
  protected valido(): boolean {
    return this.password().length >= 12
        && this.email().includes('@')
        && this.nombre().trim().length >= 2;
  }

  protected async aceptar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.ocupado() || !this.valido()) {
      return;
    }

    this.ocupado.set(true);
    this.error.set(null);

    try {
      await this.auth.acceptInvitation(
        this.code(), this.email(), this.password(), this.nombre().trim(),
      );
      // El backend devuelve la sesión ya iniciada: no hay que pasar por login.
      await this.router.navigate(['/entries']);
    } catch {
      // Caducada, revocada, ya usada o correo repetido: el backend no los
      // distingue a propósito, para no permitir sondear qué códigos existen.
      this.error.set('La invitación no es válida o ese correo ya tiene cuenta.');
      this.ocupado.set(false);
    }
  }
}
