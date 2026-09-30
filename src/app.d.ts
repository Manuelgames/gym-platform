/// <reference types="astro/client" />

declare global {
  namespace App {
    /** Contexto mínimo de autenticación conservado por Astro Sessions. */
    interface SessionData {
      userId?: string;
      sessionVersion?: number;
      pendingExternalRegistration?: import('./application/facade').PendingExternalRegistration;
      googleLinkCsrf?: string;
    }

    /** Valores resueltos server-side y compartidos con páginas y endpoints. */
    interface Locals {
      /** Política de acceso aplicada por middleware durante esta petición. */
      accessMode: import('./infrastructure/config/environment').AppAccessMode;
      /** Perfil público autenticado/demo o null en una petición invitada. */
      user: import('./application/facade').PublicUser | null;
      /** Roles activos que determinan si debe aparecer Mi trabajo. */
      specialistRoles: import('./domain/specialists/specialist').SpecialistRole[];
    }
  }
}

export {};
