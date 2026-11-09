import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <h1>Un Capítulo Más</h1>

    <form (ngSubmit)="submit()">
      <label>
        Correo
        <input type="email" name="email" autocomplete="email"
               [(ngModel)]="email" required />
      </label>

      <label>
        Contraseña
        <input type="password" name="password" autocomplete="current-password"
               [(ngModel)]="password" required />
      </label>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <button class="primary" type="submit" [disabled]="busy()">
        {{ busy() ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>

    <p class="muted">
      No hay registro abierto. Se entra con una invitación.
    </p>
  `,
  styles: `
    :host { display: block; max-width: 380px; margin: 3rem auto; }
    form { display: grid; gap: 1rem; }
    label { display: grid; gap: 0.35rem; }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email, this.password);
      // Vuelve a donde iba antes de que el guard le desviase.
      const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/entries';
      await this.router.navigateByUrl(redirect);
    } catch {
      // El backend nunca distingue "no existe" de "contraseña incorrecta",
      // así que aquí tampoco.
      this.error.set('Credenciales no válidas.');
    } finally {
      this.busy.set(false);
    }
  }
}
