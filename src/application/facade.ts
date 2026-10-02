import type { CalorieCalculation } from '../domain/calories/calorie';
import type {
  DietGuide,
  DietMealInput,
  DietPlan,
  DietPlanSource,
} from '../domain/diet/diet';
import type {
  RoutineByDay,
  RoutineExercise,
  RoutinePlan,
  RoutinePlanDayInput,
  RoutinePlanSource,
} from '../domain/routine/routine';
import type {
  SpecialistMediaReference,
  SpecialistRequestAction,
  SpecialistRequestStatus,
  SpecialistRole,
} from '../domain/specialists/specialist';
import type { IdentityProvider, ProfileSex } from '../domain/users/user';
import type { MediaContent, MediaUpload, SpecialistMediaContent, SpecialistMediaUpload } from './ports/services';

/** Usuario seguro para UI; excluye identidades y hashes de credenciales. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  birthDate: string;
  sex: ProfileSex;
  profilePhotoId: string | null;
  identityProviders: IdentityProvider[];
  sessionVersion: number;
  createdAt: string;
}

/** Claims verificados conservados temporalmente mientras se completa el perfil. */
export interface PendingExternalRegistration {
  provider: Exclude<IdentityProvider, 'password'>;
  subject: string;
  email: string;
  displayName: string;
  expiresAt: string;
}

/** Resultado seguro del primer intercambio con un proveedor externo. */
export type ExternalAuthenticationResult =
  | { kind: 'authenticated'; user: PublicUser }
  | { kind: 'profile-required'; pending: PendingExternalRegistration };

/** Datos que Google no proporciona y requiere el perfil de la aplicación. */
export interface CompleteExternalRegistrationInput {
  pending: PendingExternalRegistration;
  birthDate: string;
  sex: string;
}

/** Campos exigidos para sustituir una credencial local. */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  passwordConfirmation: string;
}

/** Datos del formulario de registro por contraseña. */
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  birthDate: string;
  sex: string;
}

/** El registro se crea pendiente incluso si el proveedor rechazó el primer envío. */
export type RegistrationDelivery = 'sent' | 'failed';

/** Credenciales del formulario de inicio de sesión. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Datos del formulario para añadir un ejercicio. */
export interface AddRoutineExerciseInput {
  day: string;
  muscle: string;
  name: string;
  sets: number;
  reps: string;
  notes?: string;
}

/** Parámetros que personalizan la generación automática de entrenamiento. */
export interface GenerateRoutineInput {
  title?: string;
  goal: string;
  level: string;
  location: string;
  sessionDurationMinutes: number;
  restDays: string[];
}

/** Documento escrito desde el editor común de usuario o entrenador. */
export interface SaveEditableRoutineInput {
  title: string;
  summary: string;
  goal: string;
  level: string;
  location: string;
  sessionDurationMinutes: number;
  days: RoutinePlanDayInput[];
}

/** Datos del formulario para guardar el plan dietario vigente. */
export interface SaveDietInput {
  goal: string;
  preference: string;
  meals: number;
}

/** Documento creado desde el editor reutilizable de usuario o nutricionista. */
export interface SaveEditableDietInput {
  title: string;
  summary: string;
  goal: string;
  preference: string;
  entries: DietMealInput[];
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

/** Datos numéricos requeridos por la calculadora. */
export interface CalculateCaloriesInput {
  age: number;
  sex: string;
  weightKg: number;
  heightCm: number;
  activityFactor: number;
}

/** Vista completa de la rutina semanal. */
export interface RoutineView {
  days: RoutineByDay;
  totalExercises: number;
}

/** Contexto autorizado que necesita un entrenador para editar la rutina asignada. */
export interface TrainingClientRoutineView {
  requestId: string;
  client: PublicUser;
  plan: RoutinePlan | null;
}

/** Vista del plan vigente junto con la explicación derivada. */
export interface DietView {
  plan: DietPlan;
  guide: DietGuide;
}

/** Contexto autorizado que el nutricionista necesita para editar un plan. */
export interface NutritionClientDietView {
  requestId: string;
  client: PublicUser;
  latestCalories: CalorieCalculation | null;
  plan: DietPlan | null;
}

/** Resumen principal del área privada. */
export interface DashboardView {
  user: PublicUser;
  exerciseCount: number;
  hasRoutine: boolean;
  hasDiet: boolean;
  calorieCalculationCount: number;
}

/** Formulario profesional más los archivos recibidos de forma privada. */
export interface RegisterSpecialistInput {
  presentation: string;
  experience: string;
  roles: string[];
  photo: SpecialistMediaUpload;
  certificates: SpecialistMediaUpload[];
}

/** Perfil profesional seguro para las pantallas de directorio y trabajo. */
export interface SpecialistProfileView {
  id: string;
  userId: string;
  name: string;
  profilePhotoId: string | null;
  presentation: string;
  experience: string;
  roles: SpecialistRole[];
  photo: SpecialistMediaReference;
  certificates: SpecialistMediaReference[];
}

/** Solicitud abierta que actualmente ocupa un cupo del usuario. */
export interface ActiveSpecialistRequestView {
  id: string;
  specialistProfileId: string;
  specialistName: string;
  role: SpecialistRole;
  status: Extract<SpecialistRequestStatus, 'pending' | 'accepted'>;
}

/** Dos directorios y el estado personal requerido por una sola pantalla. */
export interface SpecialistsPageView {
  trainers: SpecialistProfileView[];
  nutritionists: SpecialistProfileView[];
  myProfile: SpecialistProfileView | null;
  activeRequests: Partial<Record<SpecialistRole, ActiveSpecialistRequestView>>;
}

/** Persona visible en una categoría de Mi trabajo. */
export interface WorkClientView {
  requestId: string;
  userId: string;
  name: string;
  email: string;
  profilePhotoId: string | null;
  requestedAt: string;
}

/** Tablero de un rol activo con solicitantes y asesorados separados. */
export interface SpecialistWorkRoleView {
  role: SpecialistRole;
  applicants: WorkClientView[];
  advised: WorkClientView[];
}

/** Contenido completo del apartado que aparece al registrar un perfil. */
export interface MyWorkView {
  profile: SpecialistProfileView;
  roles: SpecialistWorkRoleView[];
}

/**
 * Contrato estable consumido por middleware, endpoints y páginas SSR.
 *
 * Ningún método acepta un userId procedente de FormData. El llamador debe usar
 * exclusivamente el identificador resuelto desde Astro Sessions.
 */
export interface ApplicationFacade {
  register(input: RegisterInput): Promise<RegistrationDelivery>;
  login(input: LoginInput): Promise<PublicUser>;
  authenticateWithExternalIdentity(idToken: string): Promise<ExternalAuthenticationResult>;
  completeExternalRegistration(input: CompleteExternalRegistrationInput): Promise<PublicUser>;
  linkExternalIdentity(userId: string, idToken: string): Promise<PublicUser>;
  requestEmailVerification(email: string): Promise<void>;
  verifyEmail(userId: string, token: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(userId: string, token: string, password: string, confirmation: string): Promise<void>;
  /** Obtiene o crea el perfil reservado usado únicamente por el modo demo. */
  getDemoUser(): Promise<PublicUser>;
  getCurrentUser(userId: string): Promise<PublicUser | null>;
  getProfile(userId: string): Promise<PublicUser>;
  updateProfileName(userId: string, name: string): Promise<PublicUser>;
  updateProfilePhoto(userId: string, photo: MediaUpload): Promise<PublicUser>;
  changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
  getProfilePhoto(viewerUserId: string, targetUserId: string): Promise<MediaContent | null>;
  getDashboard(userId: string): Promise<DashboardView>;
  getRoutine(userId: string): Promise<RoutineView>;
  addRoutineExercise(userId: string, input: AddRoutineExerciseInput): Promise<RoutineExercise>;
  deleteRoutineExercise(userId: string, exerciseId: string): Promise<void>;
  getRoutinePlan(userId: string, source?: RoutinePlanSource): Promise<RoutinePlan | null>;
  getRoutineHistory(userId: string, source: RoutinePlanSource): Promise<RoutinePlan[]>;
  generateRoutine(userId: string, input: GenerateRoutineInput): Promise<RoutinePlan>;
  saveManualRoutine(userId: string, input: SaveEditableRoutineInput): Promise<RoutinePlan>;
  reuseRoutinePlan(userId: string, planId: string): Promise<RoutinePlan>;
  deleteRoutinePlanFromHistory(userId: string, planId: string): Promise<RoutinePlanSource>;
  getTrainingClientRoutine(specialistUserId: string, requestId: string): Promise<TrainingClientRoutineView>;
  saveSpecialistRoutine(
    specialistUserId: string,
    requestId: string,
    input: SaveEditableRoutineInput,
  ): Promise<RoutinePlan>;
  getRoutineForDownload(userId: string, source: RoutinePlanSource): Promise<RoutinePlan>;
  getDiet(userId: string, source?: DietPlanSource): Promise<DietView | null>;
  saveDiet(userId: string, input: SaveDietInput): Promise<DietView>;
  saveManualDiet(userId: string, input: SaveEditableDietInput): Promise<DietView>;
  getNutritionClientDiet(specialistUserId: string, requestId: string): Promise<NutritionClientDietView>;
  saveSpecialistDiet(
    specialistUserId: string,
    requestId: string,
    input: SaveEditableDietInput,
  ): Promise<DietView>;
  getDietForDownload(userId: string, source: DietPlanSource): Promise<DietPlan>;
  getCalories(userId: string): Promise<CalorieCalculation[]>;
  calculateCalories(userId: string, input: CalculateCaloriesInput): Promise<CalorieCalculation>;
  deleteCalorieCalculation(userId: string, calculationId: string): Promise<void>;
  getSpecialistsPage(userId: string): Promise<SpecialistsPageView>;
  registerSpecialist(userId: string, input: RegisterSpecialistInput): Promise<SpecialistProfileView>;
  requestSpecialist(userId: string, specialistProfileId: string, role: string): Promise<void>;
  actOnSpecialistRequest(userId: string, requestId: string, action: SpecialistRequestAction): Promise<void>;
  getMyWork(userId: string): Promise<MyWorkView | null>;
  getMySpecialistRoles(userId: string): Promise<SpecialistRole[]>;
  getSpecialistMedia(userId: string, mediaId: string): Promise<SpecialistMediaContent | null>;
}
