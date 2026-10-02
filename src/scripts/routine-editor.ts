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
const dayLabels: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

function fieldValue(container: Element, name: string): string {
  const field = container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    `[data-exercise-field="${name}"]`,
  );
  return field?.value.trim() ?? '';
}

document.querySelectorAll<HTMLFormElement>('[data-routine-editor]').forEach((form) => {
  if (form.dataset.routineReady === 'true') return;
  form.dataset.routineReady = 'true';

  const daysInput = form.querySelector<HTMLInputElement>('[data-routine-days]');
  const exerciseTemplate = form.querySelector<HTMLTemplateElement>('[data-routine-exercise-template]');
  const tabs = [...form.querySelectorAll<HTMLButtonElement>('[data-editor-tab]')];
  const panels = [...form.querySelectorAll<HTMLElement>('[data-editor-panel]')];
  const dayOverlay = form.querySelector<HTMLElement>('[data-day-editor-overlay]');
  const activeDayTitle = form.querySelector<HTMLElement>('[data-active-day-title]');
  if (!daysInput || !exerciseTemplate || !dayOverlay) return;

  let draggedExercise: HTMLElement | null = null;
  let revealingInvalidField = false;

  const activatePanel = (name: string): void => {
    dayOverlay.hidden = true;
    form.querySelectorAll<HTMLElement>('[data-routine-day]').forEach((day) => { day.hidden = true; });
    tabs.forEach((tab) => {
      const active = tab.dataset.editorTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.editorPanel !== name; });
  };

  const openDay = (name: string): void => {
    panels.forEach((panel) => { panel.hidden = true; });
    dayOverlay.hidden = false;
    form.querySelectorAll<HTMLElement>('[data-routine-day]').forEach((day) => {
      day.hidden = day.dataset.day !== name;
    });
    if (activeDayTitle) activeDayTitle.textContent = dayLabels[name] ?? 'Día';
    dayOverlay.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

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
      if (field) {
        field.disabled = rest || usesDuration;
        field.required = !rest && !usesDuration;
      }
    });
    exercise.querySelectorAll<HTMLElement>('[data-duration-field]').forEach((wrapper) => {
      wrapper.toggleAttribute('hidden', !usesDuration);
      const field = wrapper.querySelector<HTMLSelectElement>('[data-exercise-field]');
      if (field) {
        field.disabled = rest || !usesDuration;
        field.required = !rest && usesDuration;
      }
    });
  };

  const updateDayState = (day: HTMLElement): void => {
    const rest = day.querySelector<HTMLInputElement>('[data-day-rest]')?.checked ?? false;
    const exercises = [...day.querySelectorAll<HTMLElement>('[data-routine-exercise]')];
    day.classList.toggle('is-rest-day', rest);
    day.querySelector<HTMLElement>('[data-day-exercises]')?.toggleAttribute('hidden', rest);
    exercises.forEach((exercise) => updateExerciseState(exercise, rest));
    const opener = form.querySelector<HTMLButtonElement>(`[data-open-routine-day="${day.dataset.day}"]`);
    const status = opener?.querySelector<HTMLElement>('[data-week-day-status]');
    opener?.classList.toggle('is-rest-day', rest);
    if (status) status.textContent = rest ? 'Descanso' : `${exercises.length} ejercicio${exercises.length === 1 ? '' : 's'}`;
  };

  const setExerciseExpanded = (exercise: HTMLElement, expanded: boolean): void => {
    exercise.classList.toggle('is-expanded', expanded);
    exercise.querySelector<HTMLElement>('[data-exercise-fields]')?.toggleAttribute('hidden', !expanded);
    const toggle = exercise.querySelector<HTMLButtonElement>('[data-toggle-routine-exercise]');
    if (toggle) {
      const name = fieldValue(exercise, 'name') || 'ejercicio';
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', `${expanded ? 'Ocultar' : 'Mostrar'} ${name}`);
    }
  };

  const addExercise = (day: HTMLElement): void => {
    const rows = day.querySelector<HTMLElement>('[data-exercise-rows]');
    if (!rows || rows.children.length >= 20) return;
    rows.append(exerciseTemplate.content.cloneNode(true));
    updateDayState(day);
    const newExercise = rows.lastElementChild as HTMLElement | null;
    if (newExercise) setExerciseExpanded(newExercise, true);
    newExercise?.querySelector<HTMLInputElement>('[data-exercise-field="name"]')?.focus();
  };

  const validateExercise = (exercise: HTMLElement): boolean => {
    const fields = [...exercise.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')]
      .filter((field) => !field.disabled);
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    return true;
  };

  form.querySelectorAll<HTMLElement>('[data-routine-day]').forEach((day) => updateDayState(day));

  form.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.matches('[data-day-rest]') && target instanceof HTMLInputElement) {
      const day = target.closest<HTMLElement>('[data-routine-day]');
      if (day) {
        const rows = day.querySelector<HTMLElement>('[data-exercise-rows]');
        if (!target.checked && rows?.children.length === 0) addExercise(day);
        updateDayState(day);
      }
      return;
    }
    if (target.matches('[data-exercise-field="muscle"], [data-exercise-field="prescriptionType"]')) {
      const exercise = target.closest<HTMLElement>('[data-routine-exercise]');
      const day = target.closest<HTMLElement>('[data-routine-day]');
      if (exercise) updateExerciseState(exercise, day?.querySelector<HTMLInputElement>('[data-day-rest]')?.checked ?? false);
    }
  });

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const exercise = target.closest<HTMLElement>('[data-routine-exercise]');
    if (!exercise) return;
    if (target.matches('[data-exercise-field="name"]')) {
      const label = exercise.querySelector<HTMLElement>('[data-exercise-label]');
      if (label && target instanceof HTMLInputElement) label.textContent = target.value.trim() || 'Nuevo ejercicio';
      setExerciseExpanded(exercise, exercise.classList.contains('is-expanded'));
    }
  });

  form.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const tab = target.closest<HTMLButtonElement>('[data-editor-tab]');
    if (tab) {
      activatePanel(tab.dataset.editorTab ?? 'general');
      return;
    }

    const dayOpener = target.closest<HTMLButtonElement>('[data-open-routine-day]');
    if (dayOpener) {
      openDay(dayOpener.dataset.openRoutineDay ?? 'lunes');
      return;
    }

    if (target.closest('[data-close-routine-day]')) {
      activatePanel('week');
      return;
    }

    const day = target.closest<HTMLElement>('[data-routine-day]');
    if (!day) return;
    if (target.closest('[data-add-routine-exercise]')) {
      const expandedExercises = [...day.querySelectorAll<HTMLElement>('[data-routine-exercise].is-expanded')];
      if (expandedExercises.some((exercise) => !validateExercise(exercise))) return;
      day.querySelectorAll<HTMLElement>('[data-routine-exercise]').forEach((exercise) => setExerciseExpanded(exercise, false));
      addExercise(day);
      return;
    }
    if (target.closest('[data-save-routine-day]')) {
      const rest = day.querySelector<HTMLInputElement>('[data-day-rest]')?.checked ?? false;
      const rows = day.querySelector<HTMLElement>('[data-exercise-rows]');
      if (!rest && rows?.children.length === 0) addExercise(day);
      const invalid = [...day.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')]
        .find((field) => !field.disabled && !field.checkValidity());
      if (invalid) {
        const invalidExercise = invalid.closest<HTMLElement>('[data-routine-exercise]');
        if (invalidExercise) setExerciseExpanded(invalidExercise, true);
        invalid.reportValidity();
        invalid.focus();
      } else {
        updateDayState(day);
        activatePanel('week');
      }
      return;
    }

    const exercise = target.closest<HTMLElement>('[data-routine-exercise]');
    if (!exercise) return;
    if (target.closest('[data-toggle-routine-exercise]')) {
      const expanded = exercise.classList.contains('is-expanded');
      if (!expanded) {
        day.querySelectorAll<HTMLElement>('[data-routine-exercise]').forEach((item) => setExerciseExpanded(item, false));
      }
      setExerciseExpanded(exercise, !expanded);
      return;
    }
    const move = target.closest<HTMLButtonElement>('[data-move-exercise]');
    if (move) {
      if (move.dataset.moveExercise === 'up') exercise.previousElementSibling?.before(exercise);
      else exercise.nextElementSibling?.after(exercise);
      updateDayState(day);
      return;
    }
    if (target.closest('[data-remove-routine-exercise]')) {
      exercise.remove();
      updateDayState(day);
    }
  });

  form.addEventListener('dragstart', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('[data-exercise-drag-handle]')) return;
    draggedExercise = target.closest<HTMLElement>('[data-routine-exercise]');
    draggedExercise?.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', 'routine-exercise');
    }
  });

  form.addEventListener('dragover', (event) => {
    if (!draggedExercise) return;
    const list = (event.target as Element | null)?.closest<HTMLElement>('[data-exercise-rows]');
    if (!list || draggedExercise.parentElement !== list) return;
    event.preventDefault();
    const siblings = [...list.querySelectorAll<HTMLElement>('[data-routine-exercise]:not(.is-dragging)')];
    const after = siblings.find((item) => event.clientY < item.getBoundingClientRect().top + item.offsetHeight / 2);
    if (after) list.insertBefore(draggedExercise, after);
    else list.append(draggedExercise);
  });

  form.addEventListener('dragend', () => {
    const day = draggedExercise?.closest<HTMLElement>('[data-routine-day]');
    draggedExercise?.classList.remove('is-dragging');
    draggedExercise = null;
    if (day) updateDayState(day);
  });

  form.addEventListener('invalid', (event) => {
    if (revealingInvalidField) return;
    revealingInvalidField = true;
    requestAnimationFrame(() => { revealingInvalidField = false; });
    const field = event.target;
    if (!(field instanceof Element)) return;
    const day = field.closest<HTMLElement>('[data-routine-day]');
    if (day?.dataset.day) {
      openDay(day.dataset.day);
      const exercise = field.closest<HTMLElement>('[data-routine-exercise]');
      if (exercise) setExerciseExpanded(exercise, true);
    }
    else activatePanel('general');
  }, true);

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
