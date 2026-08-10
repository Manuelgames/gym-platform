/* Datos y sesión de Roman Colosseum.
   Cada perfil mantiene su propio progreso dentro del mismo registro. */
(function () {
  const USERS_KEY = 'romanColosseum.users.v2';
  const SESSION_KEY = 'romanColosseum.session.v2';
  const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

  const safeParse = (value, fallback) => {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  };

  function emptyRoutine() {
    return Object.fromEntries(DAYS.map(day => [day, []]));
  }

  function normaliseUser(user) {
    return {
      id: user.id || `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: user.name || 'Guerrero',
      email: String(user.email || '').toLowerCase(),
      password: user.password || '',
      birthDate: user.birthDate || '',
      sex: user.sex || '',
      createdAt: user.createdAt || new Date().toISOString(),
      data: {
        routine: { ...emptyRoutine(), ...(user.data?.routine || {}) },
        diet: user.data?.diet || null,
        calorieHistory: Array.isArray(user.data?.calorieHistory) ? user.data.calorieHistory : []
      }
    };
  }

  function migrateLegacyUsers() {
    const legacyEmails = safeParse(localStorage.getItem('correoRegistro'), []);
    if (!Array.isArray(legacyEmails) || !legacyEmails.length) return [];
    const names = safeParse(localStorage.getItem('nombreRegistro'), []);
    const passwords = safeParse(localStorage.getItem('claveRegistro'), []);
    const births = safeParse(localStorage.getItem('nacimientoRegistro'), []);
    const sexes = safeParse(localStorage.getItem('sexoRegistro'), []);
    const legacyRoutines = safeParse(localStorage.getItem('rutinaUsuarios'), []);
    return legacyEmails.map((email, index) => {
      const legacyWeek = legacyRoutines?.[index]?.semana || legacyRoutines?.[String(index)]?.semana;
      const routine = emptyRoutine();
      if (Array.isArray(legacyWeek)) {
        legacyWeek.forEach((exercises, dayIndex) => {
          if (!Array.isArray(exercises) || !DAYS[dayIndex]) return;
          routine[DAYS[dayIndex]] = exercises.map(item => ({
            id: item.id || `legacy_exercise_${dayIndex}_${Math.random().toString(36).slice(2, 7)}`,
            muscle: item.muscle || item.grupoMuscular || 'General',
            name: item.name || item.nombreEjercicio || 'Ejercicio',
            sets: item.sets || item.numeroSeries || '',
            reps: item.reps || item.numeroRepeticiones || '',
            notes: item.notes || item.descripcionEjercicio || ''
          }));
        });
      }
      return normaliseUser({
      id: `legacy_${index}_${String(email).replace(/[^a-z0-9]/gi, '')}`,
      name: names[index], email, password: passwords[index], birthDate: births[index], sex: sexes[index], data: { routine }
      });
    });
  }

  function getUsers() {
    const stored = safeParse(localStorage.getItem(USERS_KEY), null);
    if (Array.isArray(stored)) return stored.map(normaliseUser);
    const migrated = migrateLegacyUsers();
    if (migrated.length) {
      localStorage.setItem(USERS_KEY, JSON.stringify(migrated));
      const oldSession = safeParse(localStorage.getItem('sesionIniciada'), []);
      const oldActive = safeParse(localStorage.getItem('usuarioActivo'), []);
      if (oldSession?.[0] === 1 && Number.isInteger(oldActive?.[0]) && migrated[oldActive[0]]) {
        localStorage.setItem(SESSION_KEY, migrated[oldActive[0]].id);
      }
    }
    return migrated;
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users.map(normaliseUser)));
  }

  function getSessionId() {
    return localStorage.getItem(SESSION_KEY);
  }

  function currentUser() {
    const users = getUsers();
    const id = getSessionId();
    return users.find(user => user.id === id) || null;
  }

  function updateCurrentUser(mutator) {
    const id = getSessionId();
    const users = getUsers();
    const index = users.findIndex(user => user.id === id);
    if (index < 0) return null;
    const updated = normaliseUser(mutator(structuredClone(users[index])) || users[index]);
    users[index] = updated;
    saveUsers(users);
    return updated;
  }

  function login(email, password) {
    const user = getUsers().find(item => item.email === email.trim().toLowerCase());
    if (!user) return { ok: false, reason: 'email' };
    if (user.password !== password) return { ok: false, reason: 'password' };
    localStorage.setItem(SESSION_KEY, user.id);
    return { ok: true, user };
  }

  function register({ name, email, password, birthDate, sex }) {
    const users = getUsers();
    const cleanEmail = email.trim().toLowerCase();
    if (users.some(user => user.email === cleanEmail)) return { ok: false, reason: 'email' };
    const user = normaliseUser({ name: name.trim(), email: cleanEmail, password, birthDate, sex });
    users.push(user);
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, user.id);
    return { ok: true, user };
  }

  function logout() { localStorage.removeItem(SESSION_KEY); }
  window.RomanApp = { DAYS, getUsers, currentUser, updateCurrentUser, login, register, logout };
}());
