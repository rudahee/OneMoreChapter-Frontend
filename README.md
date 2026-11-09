# Un Capítulo Más — cliente

Angular 22 (zoneless, signals) + Capacitor 8. Sin Ionic: su paquete de Angular
suele ir un major por detrás y para dos usuarios no compensa la fricción.

## Arrancar

```bash
npm install
npm start            # http://localhost:4200
```

Necesita el backend en `http://localhost:8080`. Si lo cambias, toca
`src/environments/environment.ts`.

## Instalable: dos caminos

**PWA.** `npm run build` genera el service worker y el manifest. Chrome y Edge
ofrecen instalar; `InstallService` captura `beforeinstallprompt` para enseñar
tu propio botón. **Safari e iOS no implementan ese evento**: ahí se instala a
mano desde Compartir → Añadir a pantalla de inicio, y el servicio detecta iOS
para poder mostrar instrucciones en vez de un botón muerto.

Requisitos para que el navegador ofrezca instalar: HTTPS, manifest válido,
service worker activo y los tres iconos. Todo está puesto.

**APK de Android.**

```bash
npx cap add android      # una sola vez
npm run apk              # dist/ → sync → gradlew assembleDebug
```

El APK sin firmar sale en `android/app/build/outputs/apk/debug/`. Se instala
por sideload: no hace falta cuenta de desarrollador ni Play Store.

Para iOS necesitarías un Mac y los 99 €/año de Apple. Si el otro móvil es un
iPhone, la PWA es la vía realista.

## Estructura

```
src/app/
├── core/       auth, tokens, interceptor, tiempo real, cola offline, instalación
├── api/        acceso HTTP, un servicio por área del backend
└── features/   pantallas, cargadas de forma perezosa
```

`core/api.types.ts` es el espejo de los DTO de Java. Si cambias un `record` en
el backend, cambia aquí.

## Detalles que no son obvios

**El interceptor comparte una única promesa de refresco.** Al caducar el token
hay varias llamadas en vuelo que fallan a la vez; sin eso, cada una pediría su
propio refresco y como el backend rota el token, la segunda llegaría con uno ya
revocado y tumbaría la sesión por falsa detección de reutilización.

**La cola offline solo admite operaciones idempotentes.** Marcar un episodio ya
marcado el backend lo ignora. No metas ahí nada que cree recursos: si la
respuesta se pierde pero el servidor sí la procesó, el reenvío duplica.

**El socket manda avisos, no datos.** Al recibir uno se recarga el recurso
afectado. Menos eficiente que aplicar deltas, pero se corrige solo si los
mensajes llegan desordenados o el socket estuvo caído.

**Los orígenes deben coincidir.** `capacitor.config.ts` usa
`androidScheme: 'https'`, así que el WebView sirve desde `https://localhost`.
Ese origen tiene que estar en el `CorsConfig` del backend o la app compila y
luego no puede llamar a la API.

## Pendiente

- Pantallas de búsqueda y alta de obras (`MetadataApi` ya está).
- Canje de invitación (`AuthService.acceptInvitation` ya está, falta la vista).
- Notas y valoraciones.
- Iconos: los incluidos son un marcador de posición generado. Sustitúyelos.
