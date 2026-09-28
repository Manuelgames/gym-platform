import type { ApplicationFacade } from '../../application/facade';
import { AuthUseCases } from '../../application/use-cases/auth';
import { PasswordRecoveryUseCases } from '../../application/use-cases/password-recovery';
import { CalorieUseCases } from '../../application/use-cases/calories';
import { DashboardUseCase } from '../../application/use-cases/dashboard';
import { DietUseCases } from '../../application/use-cases/diet';
import { ProfileUseCases } from '../../application/use-cases/profile';
import { RoutineUseCases } from '../../application/use-cases/routine';
import { SpecialistUseCases } from '../../application/use-cases/specialists';
import { OpenAIDietGenerator } from '../ai/openai-diet-generator';
import { OpenAIRoutineGenerator } from '../ai/openai-routine-generator';
import { loadAstroServerEnvironment } from '../config/astro-environment';
import { BrevoRecoveryMailer } from '../email/brevo-recovery-mailer';
import { ResendRecoveryMailer } from '../email/resend-recovery-mailer';
import { FileDataStore } from '../persistence/file/file-data-store';
import { DATA_SCHEMA_VERSION } from '../persistence/file/schema';
import { LocalMediaStore } from '../persistence/file/local-media-store';
import { ScryptPasswordHasher } from '../security/scrypt-password-hasher';
import { CryptoRecoveryTokenService } from '../security/recovery-token-service';
import { CryptoIdGenerator, SystemClock } from '../system/node-services';

type GlobalContainer = typeof globalThis & {
  __romanColosseumApplicationFacade__?: ApplicationFacade;
  __romanColosseumApplicationFacadeVersion__?: number;
};

// El contrato usa un bloque propio y suma el esquema vigente. Así un cambio de
// persistencia invalida automáticamente el singleton que sobrevive al hot reload.
const APPLICATION_FACADE_VERSION = 4_000 + DATA_SCHEMA_VERSION;

function shouldReplaceApplicationFacade(
  storedVersion: number | undefined,
  currentVersion: number,
  hasValidFacade: boolean,
): boolean {
  // Un módulo antiguo puede terminar una solicitud durante HMR, pero nunca
  // debe reemplazar un facade construido con un esquema más reciente.
  if (storedVersion !== undefined && storedVersion > currentVersion) return false;
  return storedVersion !== currentVersion || !hasValidFacade;
}

function isCurrentApplicationFacade(
  facade: ApplicationFacade | undefined,
): facade is ApplicationFacade {
  return Boolean(
    facade
    && typeof facade.getProfile === 'function'
    && typeof facade.updateProfileName === 'function'
    && typeof facade.updateProfilePhoto === 'function'
    && typeof facade.changePassword === 'function'
    && typeof facade.getProfilePhoto === 'function'
    && typeof facade.generateRoutine === 'function'
    && typeof facade.saveManualRoutine === 'function'
    && typeof facade.saveSpecialistRoutine === 'function'
    && typeof facade.saveManualDiet === 'function'
    && typeof facade.saveSpecialistDiet === 'function'
    && typeof facade.deleteCalorieCalculation === 'function'
    && typeof facade.requestPasswordReset === 'function'
    && typeof facade.resetPassword === 'function'
    && typeof facade.requestEmailVerification === 'function'
    && typeof facade.verifyEmail === 'function'
  );
}

function composeApplication(): ApplicationFacade {
  const environment = loadAstroServerEnvironment();
  if (environment.authProvider !== 'password') {
    throw new Error(
      `AUTH_PROVIDER=${environment.authProvider} está reservado para un adaptador futuro y aún no está implementado.`,
    );
  }
  const store = new FileDataStore(environment.dataFilePath);
  const clock = new SystemClock();
  const ids = new CryptoIdGenerator();
  const recoveryMailer = environment.recoveryEmailFrom
    ? environment.brevoApiKey
      ? new BrevoRecoveryMailer(environment.brevoApiKey, environment.recoveryEmailFrom)
      : environment.resendApiKey
        ? new ResendRecoveryMailer(environment.resendApiKey, environment.recoveryEmailFrom)
        : null
    : null;
  if (recoveryMailer && environment.nodeEnv === 'production'
    && new URL(environment.appOrigin).protocol !== 'https:') {
    throw new Error('APP_ORIGIN debe usar HTTPS para enviar enlaces de recuperación en producción.');
  }
  const auth = new AuthUseCases(
    store, new ScryptPasswordHasher(), clock, ids, new CryptoRecoveryTokenService(),
    recoveryMailer, environment.appOrigin,
  );
  const recovery = new PasswordRecoveryUseCases(
    store, new ScryptPasswordHasher(), clock, new CryptoRecoveryTokenService(),
    recoveryMailer, environment.appOrigin,
  );
  const routine = new RoutineUseCases(
    store,
    store,
    store,
    new OpenAIRoutineGenerator(environment.openAiApiKey, environment.openAiModel),
    clock,
    ids,
  );
  const diet = new DietUseCases(
    store,
    store,
    store,
    new OpenAIDietGenerator(environment.openAiApiKey, environment.openAiModel),
    clock,
    ids,
  );
  const calories = new CalorieUseCases(store, clock, ids);
  const dashboard = new DashboardUseCase(store, store);
  const media = new LocalMediaStore(environment.uploadsDirectory);
  const profile = new ProfileUseCases(store, new ScryptPasswordHasher(), media, clock, ids);
  const specialists = new SpecialistUseCases(
    store,
    store,
    media,
    clock,
    ids,
  );

  return Object.freeze({
    register: auth.register.bind(auth),
    login: auth.login.bind(auth),
    requestEmailVerification: auth.requestEmailVerification.bind(auth),
    verifyEmail: auth.verifyEmail.bind(auth),
    requestPasswordReset: recovery.request.bind(recovery),
    resetPassword: recovery.reset.bind(recovery),
    getDemoUser: auth.getDemoUser.bind(auth),
    getCurrentUser: auth.getCurrentUser.bind(auth),
    getProfile: profile.get.bind(profile),
    updateProfileName: profile.updateName.bind(profile),
    updateProfilePhoto: profile.updatePhoto.bind(profile),
    changePassword: profile.changePassword.bind(profile),
    getProfilePhoto: profile.getPhoto.bind(profile),
    getDashboard: dashboard.get.bind(dashboard),
    getRoutine: routine.get.bind(routine),
    addRoutineExercise: routine.add.bind(routine),
    deleteRoutineExercise: routine.delete.bind(routine),
    getRoutinePlan: routine.getPlan.bind(routine),
    generateRoutine: routine.generate.bind(routine),
    saveManualRoutine: routine.saveManual.bind(routine),
    getTrainingClientRoutine: routine.getTrainingClient.bind(routine),
    saveSpecialistRoutine: routine.saveSpecialist.bind(routine),
    getRoutineForDownload: routine.getForDownload.bind(routine),
    getDiet: diet.get.bind(diet),
    saveDiet: diet.save.bind(diet),
    saveManualDiet: diet.saveManual.bind(diet),
    getNutritionClientDiet: diet.getNutritionClient.bind(diet),
    saveSpecialistDiet: diet.saveSpecialist.bind(diet),
    getDietForDownload: diet.getForDownload.bind(diet),
    getCalories: calories.get.bind(calories),
    calculateCalories: calories.calculate.bind(calories),
    deleteCalorieCalculation: calories.delete.bind(calories),
    getSpecialistsPage: specialists.getPage.bind(specialists),
    registerSpecialist: specialists.register.bind(specialists),
    requestSpecialist: specialists.request.bind(specialists),
    actOnSpecialistRequest: specialists.act.bind(specialists),
    getMyWork: specialists.getMyWork.bind(specialists),
    getMySpecialistRoles: specialists.getMyRoles.bind(specialists),
    getSpecialistMedia: specialists.getMedia.bind(specialists),
  });
}

/**
 * Devuelve el facade backend del proceso.
 *
 * En desarrollo se recompone para cada solicitud: Vite puede conservar
 * instancias creadas con un parser anterior durante HMR. La cola que serializa
 * escrituras vive independientemente en `globalThis`, dentro de FileDataStore.
 * En producción, donde no existe HMR, se conserva un singleton versionado.
 */
export function getApplication(): ApplicationFacade {
  if (import.meta.env.DEV) return composeApplication();

  const container = globalThis as GlobalContainer;

  if (shouldReplaceApplicationFacade(
    container.__romanColosseumApplicationFacadeVersion__,
    APPLICATION_FACADE_VERSION,
    isCurrentApplicationFacade(container.__romanColosseumApplicationFacade__),
  )) {
    container.__romanColosseumApplicationFacade__ = composeApplication();
    container.__romanColosseumApplicationFacadeVersion__ = APPLICATION_FACADE_VERSION;
  }

  return container.__romanColosseumApplicationFacade__!;
}
