/**
 * Contrato de la API. Espejo de los record de Java.
 *
 * Los campos opcionales (`?`) son los que pueden faltar en el JSON: con
 * `spring.jackson.default-property-inclusion: non_null` el backend omite los
 * nulos en lugar de enviarlos como `null`. Tenerlo en cuenta al desestructurar.
 *
 * Las fechas viajan como cadenas ISO-8601: `Instant` en UTC con sufijo Z,
 * `LocalDate` como `YYYY-MM-DD`. Convertir en el cliente, no asumir Date.
 */

// ---------------------------------------------------------------- enumerados

export type WorkType =
  | 'MOVIE'
  | 'SERIES'
  | 'ANIME'
  | 'MANGA'
  | 'COMIC'
  | 'DOCUMENTARY'
  | 'BOOK'
  | 'ALBUM'
  | 'SONG'
  | 'PODCAST'
  | 'GAME'
  | 'OTHER';

export type WorkStatus =
  | 'ONGOING'
  | 'FINISHED'
  | 'UPCOMING'
  | 'CANCELLED'
  | 'HIATUS'
  | 'UNKNOWN';

// ------------------------------------------------------------------ comunes

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

/** RFC 7807. Forma de todos los errores del backend. */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;

  // Campos extra según el caso
  errors?: Record<string, string>;   // 400 validación
  resource?: string;                 // 404, 409
  id?: string;                       // 404
  reason?: 'STALE_VERSION';          // 409 bloqueo optimista
  rule?: string;                     // 422 regla de negocio
  provider?: string;                 // 503 proveedor saturado
  retryAfterSeconds?: number;        // 503
  traceId?: string;                  // 409 integridad, 500
}

// --------------------------------------------------------------- seguridad

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  /** Mínimo 12 caracteres. */
  newPassword: string;
}

export interface TokenResponse {
  accessToken: string;
  /**
   * Guardar en almacenamiento seguro (Capacitor Preferences con cifrado o
   * Keychain/Keystore), nunca en localStorage en la versión móvil.
   */
  refreshToken: string;
  tokenType: 'Bearer';
  /** Segundos de validez del accessToken. */
  expiresIn: number;
}

export interface CurrentUserResponse {
  id: number;
  email: string;
  displayName: string;
  /** ISO-8601 UTC. Ausente si nunca ha iniciado sesión. */
  lastLoginAt?: string;
}

// --------------------------------------------------------------- metadatos

/** Resultado de búsqueda externa. Todavía NO está en el catálogo local. */
export interface WorkCandidateResponse {
  source: string;
  externalId: string;
  type: WorkType;
  title: string;
  year?: number;
  coverUrl?: string;
  externalIds: Record<string, string>;
}

export interface UnitResponse {
  /** Ausente en obras sin temporadas (manga, podcast, álbum). */
  seasonNumber?: number;
  unitNumber: number;
  /** Ausente en unidades sintéticas: solo se conoce el número. */
  title?: string;
  airDate?: string;
  runtimeMinutes?: number;
}

export interface WorkDetailResponse {
  source: string;
  externalId: string;
  type: WorkType;
  title: string;
  originalTitle?: string;
  year?: number;
  coverUrl?: string;
  episodic: boolean;
  totalUnits?: number;
  status: WorkStatus;
  externalIds: Record<string, string>;
  units: UnitResponse[];
}

// ----------------------------------------------------------------- catálogo

/**
 * Solo la procedencia. El backend rechaza título y portada del cliente: el
 * catálogo es compartido y aceptar datos arbitrarios permitiría envenenarlo.
 */
export interface ImportWorkRequest {
  source: string;
  externalId: string;
  type: WorkType;
}

/** Proyección de listado. Sin `units` ni `externalIds`. */
export interface MediaWorkSummaryResponse {
  /** Identificador propio del catálogo, NO el del proveedor. */
  id: number;
  type: WorkType;
  title: string;
  year?: number;
  coverUrl?: string;
  episodic: boolean;
  totalUnits?: number;
  status: WorkStatus;
}

export interface MediaUnitResponse {
  id: number;
  seasonNumber?: number;
  unitNumber: number;
  title?: string;
  airDate?: string;
  runtimeMinutes?: number;
}

export interface MediaWorkResponse extends MediaWorkSummaryResponse {
  originalTitle?: string;
  externalIds: Record<string, string>;
  units: MediaUnitResponse[];
}

/** `addedUnits: 0` significa que no había episodios nuevos, no que fallase. */
export interface SyncUnitsResponse {
  addedUnits: number;
}

// ------------------------------------------------------------------- rutas

export const ApiRoutes = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    password: '/api/auth/password',
  },
  metadata: {
    search: '/api/metadata/search',
    work: (source: string, externalId: string) =>
      `/api/metadata/works/${encodeURIComponent(source)}/${encodeURIComponent(externalId)}`,
  },
  catalog: {
    works: '/api/catalog/works',
    work: (id: number) => `/api/catalog/works/${id}`,
    syncUnits: (id: number) => `/api/catalog/works/${id}/units/sync`,
  },
} as const;

// --------------------------------------------------------------- entradas

export type EntryStatus = 'BACKLOG' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'DROPPED';

export interface TagResponse {
  id: number;
  name: string;
}

export interface ProgressResponse {
  seenCount: number;
  totalUnits?: number;
  currentUnitId?: number;
  positionSeconds?: number;
  complete: boolean;
  /** Ausente si no se conoce el total de unidades. */
  percentage?: number;
}

export interface RatingResponse {
  userId: number;
  displayName: string;
  score: number;
  review?: string;
  updatedAt: string;
}

export interface NoteResponse {
  id: number;
  unitId?: number;
  /** Etiqueta legible tipo "T1E03", ya calculada por el backend. */
  unitLabel?: string;
  timestampSeconds?: number;
  authorId: number;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntrySummaryResponse {
  id: number;
  status: EntryStatus;
  priority: number;
  startedAt?: string;
  finishedAt?: string;
  work: MediaWorkSummaryResponse;
  tags: TagResponse[];
}

export interface EntryResponse {
  id: number;
  status: EntryStatus;
  priority: number;
  addedByUserId: number;
  startedAt?: string;
  finishedAt?: string;
  work: MediaWorkResponse;
  progress: ProgressResponse;
  /** Ids de las unidades ya vistas, para pintar los checks sin otra llamada. */
  seenUnitIds: number[];
  ratings: RatingResponse[];
  tags: TagResponse[];
}

// --------------------------------------------------------------- espacios

export type SpaceRole = 'OWNER' | 'MEMBER';

export interface SpaceResponse {
  id: number;
  name: string;
  maxMembers?: number;
}

export interface SpaceMemberResponse {
  userId: number;
  /** No incluye el correo: dentro del espacio basta con el nombre visible. */
  displayName: string;
  role: SpaceRole;
  joinedAt: string;
}

export interface CreateInvitationRequest {
  grantedRole?: SpaceRole;
  /** Entre 1 y 720. Por defecto 72. */
  ttlHours?: number;
}

/**
 * Única respuesta de toda la API que contiene el código en claro. Solo se
 * devuelve al crearla: la base de datos guarda su hash y no hay forma de
 * recuperarlo. Si se pierde, se revoca y se crea otra.
 */
export interface CreatedInvitationResponse {
  id: number;
  code: string;
  expiresAt: string;
}

export interface InvitationResponse {
  id: number;
  grantedRole: SpaceRole;
  createdByDisplayName: string;
  createdAt: string;
  expiresAt: string;
}

export interface AcceptInvitationRequest {
  email: string;
  /** Mínimo 12 caracteres. */
  password: string;
  displayName: string;
}
