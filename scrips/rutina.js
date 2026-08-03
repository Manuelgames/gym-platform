(function () {
  const { DAYS, currentUser, updateCurrentUser } = RomanApp;
  const dayNames = { lunes:'Lunes', martes:'Martes', miercoles:'Miércoles', jueves:'Jueves', viernes:'Viernes', sabado:'Sábado', domingo:'Domingo' };
  let selectedDay = DAYS[0];
  const nav = document.querySelector('[data-week-nav]');
  const list = document.querySelector('[data-routine-list]');
  const label = document.querySelector('[data-day-label]');
  const title = document.querySelector('[data-routine-title]');
  const dialog = document.querySelector('[data-routine-dialog]');
  const form = document.querySelector('[data-routine-form]');
  const daySelect = form.elements.day;
  daySelect.innerHTML = DAYS.map(day => `<option value="${day}">${dayNames[day]}</option>`).join('');

  function render() {
    const routine = currentUser().data.routine;
    nav.innerHTML = DAYS.map(day => `<button type="button" data-day="${day}" class="${day === selectedDay ? 'is-active' : ''}"><b>${dayNames[day]}</b><span>${routine[day].length} ejercicio${routine[day].length === 1 ? '' : 's'}</span></button>`).join('');
    const exercises = routine[selectedDay];
    label.textContent = dayNames[selectedDay];
    title.textContent = exercises.length ? `${exercises.length} ejercicio${exercises.length === 1 ? '' : 's'} en tu plan` : 'Día libre para recuperar';
    list.innerHTML = exercises.length ? exercises.map((exercise, index) => `<article class="exercise"><span class="exercise-muscle">${exercise.muscle.charAt(0)}</span><div><h3>${escapeHtml(exercise.name)}</h3><p>${escapeHtml(exercise.muscle)} · ${escapeHtml(exercise.sets)} series × ${escapeHtml(exercise.reps)} reps${exercise.notes ? ` · ${escapeHtml(exercise.notes)}` : ''}</p></div><button class="icon-button" data-delete="${index}" aria-label="Eliminar ${escapeHtml(exercise.name)}">×</button></article>`).join('') : '<div class="empty"><p>No hay ejercicios todavía.<br>La recuperación también es parte de la victoria.</p></div>';
  }
  function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; }
  nav.addEventListener('click', event => { const button = event.target.closest('[data-day]'); if (button) { selectedDay = button.dataset.day; render(); } });
  list.addEventListener('click', event => { const button = event.target.closest('[data-delete]'); if (!button) return; updateCurrentUser(user => { user.data.routine[selectedDay].splice(Number(button.dataset.delete), 1); return user; }); render(); });
  document.querySelector('[data-open-routine]').addEventListener('click', () => { daySelect.value = selectedDay; dialog.showModal(); });
  document.querySelector('[data-close-routine]').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => { event.preventDefault(); const item = Object.fromEntries(new FormData(form)); updateCurrentUser(user => { user.data.routine[item.day].push({ id: crypto.randomUUID?.() || Date.now().toString(), muscle:item.muscle, name:item.name.trim(), sets:item.sets, reps:item.reps.trim(), notes:item.notes.trim() }); return user; }); selectedDay = item.day; form.reset(); dialog.close(); render(); });
  render();
}());
