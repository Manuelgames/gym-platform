/** Mensajes públicos asociados a los códigos seguros emitidos por los endpoints. */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'authentication-required': 'Inicia sesión para entrar a tu espacio personal.',
  'email-registered': 'Ese correo ya está registrado. Inicia sesión o utiliza otro.',
  'email-verification-unavailable': 'No pudimos enviar el correo de confirmación. Inténtalo más tarde.',
  'email-verification-invalid': 'El enlace venció o ya se utilizó. Solicita uno nuevo.',
  'email-not-verified': 'Confirma tu correo antes de iniciar sesión.',
  'verification-delivery-failed': 'La cuenta se creó, pero el correo no pudo enviarse. Solicita otro enlace.',
  'invalid-credentials': 'El correo o la contraseña no son válidos.',
  'google-auth-unavailable': 'No pudimos iniciar con Google. Inténtalo más tarde.',
  'google-auth-invalid': 'No pudimos validar el acceso con Google. Inténtalo de nuevo.',
  'google-link-required': 'Ya existe una cuenta con este correo. Inicia sesión con tu contraseña y vincula Google desde Mi perfil.',
  'google-profile-expired': 'El acceso con Google venció. Inténtalo nuevamente.',
  'google-identity-conflict': 'Esta cuenta de Google ya está vinculada a otro perfil.',
  'current-password-invalid': 'La contraseña actual no es correcta.',
  'password-change-unavailable': 'No es posible cambiar la contraseña de esta cuenta.',
  'recovery-unavailable': 'No pudimos enviar el correo de recuperación. Inténtalo más tarde.',
  'reset-link-invalid': 'El enlace venció o ya se utilizó. Solicita uno nuevo.',
  'profile-update-conflict': 'Tu perfil cambió en otra petición. Recarga la página e inténtalo de nuevo.',
  'exercise-not-found': 'El ejercicio ya no existe o no pertenece a tu cuenta.',
  'routine-plan-not-found': 'La rutina solicitada todavía no existe.',
  'training-relation-required': 'La asesoría de entrenamiento ya no está activa o no te pertenece.',
  'calculation-not-found': 'El cálculo ya no existe o no pertenece a tu cuenta.',
  'calorie-profile-required': 'Completa primero peso, altura y edad en la Calculadora de calorías.',
  'diet-plan-not-found': 'La dieta solicitada todavía no existe.',
  'nutrition-relation-required': 'La asesoría nutricional ya no está activa o no te pertenece.',
  'session-unavailable': 'No pudimos iniciar sesión. Inténtalo de nuevo.',
  'rate-limited': 'Hubo demasiados intentos. Espera un momento antes de volver a probar.',
  'specialist-profile-exists': 'Ya tienes un perfil de especialista registrado.',
  'specialist-not-found': 'Ese perfil de especialista ya no está disponible.',
  'specialist-role-unavailable': 'La especialidad seleccionada ya no está activa.',
  'specialist-self-request': 'No puedes solicitar orientación a tu propio perfil.',
  'specialist-request-conflict': 'Ya tienes una solicitud pendiente o una asesoría activa para esa especialidad.',
  'specialist-request-not-found': 'La solicitud ya no existe o cambió de estado.',
  validation: 'Revisa el campo señalado y vuelve a intentarlo.',
  unexpected: 'Ocurrió un problema inesperado. Inténtalo de nuevo.',
};

/** Traduce un código de query string sin exponer detalles internos del servidor. */
export function readErrorMessage(url: URL): string | undefined {
  const code = url.searchParams.get('error');
  return code ? (ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unexpected) : undefined;
}

/** Indica qué control falló en la validación server-side. */
export function readInvalidField(url: URL): string | undefined {
  return url.searchParams.get('error') === 'validation'
    ? (url.searchParams.get('field') ?? undefined)
    : undefined;
}
