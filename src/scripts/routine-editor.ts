interface RoutineExerciseValue {
  name: string;
  muscle: string;
  sets: number;
  reps: string;
  restSeconds: number;
  tempo: string;
  notes: string;
}

function fieldValue(container: Element, name: string): string {
  const field = container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    `[data-exercise-field="${name}"]`,
  );
  return field?.value.trim() ?? '';
}

document.querySelectorAll<HTMLFormElement>('[data-routine-editor]').forEach((form) => {
  const daysInput = form.querySelector<HTMLInputElement>('[data-routine-days]');
  const exerciseTemplate = form.querySelector<HTMLTemplateElement>('[data-routine-exercise-template]');
  if (!daysInput || !exerciseTemplate) return;

  const updateDayState = (day: HTMLElement): void => {
    const rest = day.querySelector<HTMLInputElement>('[data-day-rest]')?.checked ?? false;
    day.classList.toggle('is-rest-day', rest);
    day.querySelector<HTMLElement>('[data-day-exercises]')?.toggleAttribute('hidden', rest);
    day.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-exercise-field]').forEach((field) => {
      field.disabled = rest;
    });
    const badge = day.querySelector<HTMLElement>('[data-day-status]');
    if (badge) badge.textContent = rest ? 'Descanso' : 'Entrenamiento';
  };

  const addExercise = (day: HTMLElement): void => {
    const rows = day.querySelector<HTMLElement>('[data-exercise-rows]');
    if (!rows || rows.children.length >= 20) return;
    rows.append(exerciseTemplate.content.cloneNode(true));
    updateDayState(day);
  };

  form.querySelectorAll<HTMLElement>('[data-routine-day]').forEach((day) => {
    const rows = day.querySelector<HTMLElement>('[data-exercise-rows]');
    const rest = day.querySelector<HTMLInputElement>('[data-day-rest]');
    if (!rest?.checked && rows?.children.length === 0) addExercise(day);
    updateDayState(day);
  });

  form.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('[data-day-rest]')) return;
    const day = target.closest<HTMLElement>('[data-routine-day]');
    if (!day) return;
    const rows = day.querySelector<HTMLElement>('[data-exercise-rows]');
    if (!target.checked && rows?.children.length === 0) addExercise(day);
    updateDayState(day);
  });

  form.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const day = target.closest<HTMLElement>('[data-routine-day]');
    if (!day) return;
    if (target.closest('[data-add-routine-exercise]')) {
      addExercise(day);
      return;
    }
    const remove = target.closest<HTMLButtonElement>('[data-remove-routine-exercise]');
    if (!remove) return;
    remove.closest('[data-routine-exercise]')?.remove();
  });

  form.addEventListener('submit', () => {
    const days = [...form.querySelectorAll<HTMLElement>('[data-routine-day]')].map((day) => {
      const rest = day.querySelector<HTMLInputElement>('[data-day-rest]')?.checked ?? false;
      const exercises: RoutineExerciseValue[] = rest ? [] : [...day.querySelectorAll<HTMLElement>('[data-routine-exercise]')].map((exercise) => ({
        name: fieldValue(exercise, 'name'),
        muscle: fieldValue(exercise, 'muscle'),
        sets: Number(fieldValue(exercise, 'sets')),
        reps: fieldValue(exercise, 'reps'),
        restSeconds: Number(fieldValue(exercise, 'restSeconds')),
        tempo: fieldValue(exercise, 'tempo'),
        notes: fieldValue(exercise, 'notes'),
      }));
      return {
        day: day.dataset.day,
        title: day.querySelector<HTMLInputElement>('[data-day-title]')?.value.trim() ?? '',
        focus: day.querySelector<HTMLTextAreaElement>('[data-day-focus]')?.value.trim() ?? '',
        isRestDay: rest,
        exercises,
      };
    });
    daysInput.value = JSON.stringify(days);
  });
});
