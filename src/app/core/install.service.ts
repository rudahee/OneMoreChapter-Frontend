import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Instalación como PWA.
 *
 * Chrome y Edge disparan `beforeinstallprompt` cuando la app cumple los
 * requisitos (manifest válido, service worker, HTTPS) y lo dejan capturar para
 * enseñar el botón cuando quieras, en vez de con su banner.
 *
 * Safari e iOS NO lo implementan: ahí hay que instalar a mano desde Compartir
 * y "Añadir a pantalla de inicio". Por eso se detecta el navegador y se
 * enseñan instrucciones en lugar de un botón que no haría nada.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  private readonly canInstallSignal = signal(false);
  readonly canInstall = this.canInstallSignal.asReadonly();

  init(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Sin preventDefault, el navegador enseña su propio banner y pierdes el
      // control de cuándo aparece.
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canInstallSignal.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstallSignal.set(false);
    });
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }
    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    // El evento es de un solo uso: si lo rechaza, el navegador lo volverá a
    // disparar más adelante por su cuenta.
    this.deferredPrompt = null;
    this.canInstallSignal.set(false);
    return outcome === 'accepted';
  }

  /** true si ya se está ejecutando instalada. */
  isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    );
  }

  isIos(): boolean {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }
}
