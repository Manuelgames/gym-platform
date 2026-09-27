interface RoutineExerciseValue {
  name: string;
  muscle: string;
  prescriptionType: 'repetitions' | 'duration';
  sets: number | null;
  reps: string;
  durationMinutes: number | null;
  restSeconds: number;
  tempo: string;
  notes: string;
}

const timedMuscles = new Set(['Cardio', 'Acondicionamiento']);

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

  const updateExerciseState = (exercise: HTMLElement, rest: boolean): void => {
    const muscle = fieldValue(exercise, 'muscle');
    const prescription = exercise.querySelector<HTMLSelectElement>('[data-exercise-field="prescriptionType"]');
    if (!prescription) return;
    const requiresTime = timedMuscles.has(muscle);
    if (requiresTime) prescription.value = 'duration';
    const usesDuration = prescription.value === 'duration';

    exercise.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-exercise-field]').forEach((field) => {
      field.disabled = rest;
    });
    prescription.disabled = rest || requiresTime;
    exercise.querySelectorAll<HTMLElement>('[data-repetition-field]').forEach((wrapper) => {
      wrapper.toggleAttribute('hidden', usesDuration);
      const field = wrapper.querySelector<HTMLInputElement>('[data-exercise-field]');
      if (field) { field.disabled = rest || usesDuration; field.required = !rest && !usesDuration; }
    });
    exercise.querySelectorAll<HTMLElement>('[data-duration-field]').forEach((wrapper) => {
      wrapper.toggleAttribute('hidden', !usesDuration);
      const field = wrapper.querySelector<HTMLSelectElement>('[data-exercise-field]');
      if (field) { field.disabled = rest || !usesDuration; field.required = !rest && usesDuration; }
    });
  };

  const updateDayState = (day: HTMLElement): void => {
    const rest = day.querySelector<HTMLInputElement>('[data-day-rest]')?.checked ?? false;
    day.classList.toggle('is-rest-day', rest);
    day.querySelector<HTMLElement>('[data-day-exercises]')?.toggleAttribute('hidden', rest);
    day.querySelectorAll<HTMLElement>('[data-routine-exercise]').forEach((exercise) => updateExerciseState(exercise, rest));
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
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.matches('[data-day-rest]') && target instanceof HTMLInputElement) {
      const day = target.closest<HTMLElement>('[data-routine-day]');
      if (!day) return;
      const rows = day.querySelector<HTMLElement>('[data-exercise-rows]');
      if (!target.checked && rows?.children.length === 0) addExercise(day);
      updateDayState(day);
      return;
    }
    if (target.matches('[data-exercise-field="muscle"], [data-exercise-field="prescriptionType"]')) {
      const exercise = target.closest<HTMLElement>('[data-routine-exercise]');
      if (exercise) updateExerciseState(exercise, false);
    }
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
      const exercises: RoutineExerciseValue[] = rest ? [] : [...day.querySelectorAll<HTMLElement>('[data-routine-exercise]')].map((exercise) => {
        const prescriptionType = fieldValue(exercise, 'prescriptionType') === 'duration' ? 'duration' : 'repetitions';
        return {
          name: fieldValue(exercise, 'name'),
          muscle: fieldValue(exercise, 'muscle'),
          prescriptionType,
          sets: prescriptionType === 'repetitions' ? Number(fieldValue(exercise, 'sets')) : null,
          reps: prescriptionType === 'repetitions' ? fieldValue(exercise, 'reps') : '',
          durationMinutes: prescriptionType === 'duration' ? Number(fieldValue(exercise, 'durationMinutes')) : null,
          restSeconds: Number(fieldValue(exercise, 'restSeconds')),
          tempo: fieldValue(exercise, 'tempo'),
          notes: fieldValue(exercise, 'notes'),
        };
      });
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
