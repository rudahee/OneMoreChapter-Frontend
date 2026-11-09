import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth.service';
import { InstallService } from '@core/install.service';
import { OfflineQueue } from '@core/offline-queue.service';
import { RealtimeService } from '@core/realtime.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <div class="safe">
      @if (install.canInstall()) {
        <button class="primary" (click)="install.promptInstall()">
          Instalar en el móvil
        </button>
      }

      @if (queue.pending() > 0) {
        <p class="muted">{{ queue.pending() }} cambios pendientes de enviar</p>
      }

      <router-outlet />
    </div>
  `,
})
export class AppComponent {
  protected readonly install = inject(InstallService);
  protected readonly queue = inject(OfflineQueue);

  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);

  constructor() {
    // El socket se conecta al entrar y se corta al salir. Mantenerlo abierto
    // sin sesión solo consigue que el servidor rechace el CONNECT en bucle.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.realtime.connect();
      } else {
        this.realtime.disconnect();
      }
    });
  }
}
