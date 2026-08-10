type EditorControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function controlValue(scope: ParentNode, selector: string): string {
  const control = scope.querySelector<EditorControl>(selector);
  return control?.value.trim() ?? '';
}

function initializeEditor(form: HTMLFormElement): void {
  if (form.dataset.dietEditorReady === 'true') return;
  form.dataset.dietEditorReady = 'true';
  const mealsContainer = form.querySelector<HTMLElement>('[data-diet-meals]');
  const mealTemplate = form.querySelector<HTMLTemplateElement>('[data-meal-template]');
  const ingredientTemplate = form.querySelector<HTMLTemplateElement>('[data-ingredient-template]');
  const serializedInput = form.querySelector<HTMLInputElement>('[data-diet-entries]');
  if (!mealsContainer || !mealTemplate || !ingredientTemplate || !serializedInput) return;

  const addIngredient = (meal: HTMLElement): void => {
    const rows = meal.querySelector<HTMLElement>('[data-ingredient-rows]');
    if (!rows) return;
    rows.append(ingredientTemplate.content.cloneNode(true));
    rows.querySelectorAll<HTMLInputElement>('[data-ingredient-field="name"]')[rows.querySelectorAll('[data-ingredient-row]').length - 1]?.focus();
    refresh();
  };

  const refresh = (): void => {
    const meals = [...mealsContainer.querySelectorAll<HTMLElement>('[data-diet-meal]')];
    meals.forEach((meal, index) => {
      const number = meal.querySelector<HTMLElement>('[data-meal-number]');
      if (number) number.textContent = `Comida ${String(index + 1).padStart(2, '0')}`;
      const remove = meal.querySelector<HTMLButtonElement>('[data-remove-meal]');
      if (remove) {
        remove.disabled = meals.length === 1;
        remove.setAttribute('aria-label', `Eliminar comida ${index + 1}`);
      }
      const ingredientRows = [...meal.querySelectorAll<HTMLElement>('[data-ingredient-row]')];
      ingredientRows.forEach((row) => {
        const removeIngredient = row.querySelector<HTMLButtonElement>('[data-remove-ingredient]');
        if (removeIngredient) removeIngredient.disabled = ingredientRows.length === 1;
      });
      const title = controlValue(meal, '[data-meal-field="title"]');
      const heading = meal.querySelector<HTMLElement>('.meal-editor__header strong');
      if (heading) heading.textContent = title || 'Nueva comida';
    });
  };

  form.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const addMealButton = target.closest('[data-add-meal]');
    if (addMealButton) {
      const fragment = mealTemplate.content.cloneNode(true) as DocumentFragment;
      const meal = fragment.querySelector<HTMLElement>('[data-diet-meal]');
      mealsContainer.append(fragment);
      if (meal) addIngredient(meal);
      refresh();
      meal?.querySelector<HTMLInputElement>('[data-meal-field="type"]')?.focus();
      return;
    }
    const removeMealButton = target.closest('[data-remove-meal]');
    if (removeMealButton) {
      const meals = mealsContainer.querySelectorAll('[data-diet-meal]');
      if (meals.length > 1) removeMealButton.closest('[data-diet-meal]')?.remove();
      refresh();
      return;
    }
    const addIngredientButton = target.closest('[data-add-ingredient]');
    if (addIngredientButton) {
      const meal = addIngredientButton.closest<HTMLElement>('[data-diet-meal]');
      if (meal) addIngredient(meal);
      return;
    }
    const removeIngredientButton = target.closest('[data-remove-ingredient]');
    if (removeIngredientButton) {
      const meal = removeIngredientButton.closest<HTMLElement>('[data-diet-meal]');
      if (meal && meal.querySelectorAll('[data-ingredient-row]').length > 1) {
        removeIngredientButton.closest('[data-ingredient-row]')?.remove();
      }
      refresh();
    }
  });

  form.addEventListener('input', refresh);
  form.addEventListener('submit', () => {
    const entries = [...mealsContainer.querySelectorAll<HTMLElement>('[data-diet-meal]')].map((meal) => ({
      type: controlValue(meal, '[data-meal-field="type"]'),
      title: controlValue(meal, '[data-meal-field="title"]'),
      time: controlValue(meal, '[data-meal-field="time"]'),
      ingredients: [...meal.querySelectorAll<HTMLElement>('[data-ingredient-row]')].map((row) => ({
        name: controlValue(row, '[data-ingredient-field="name"]'),
        amount: Number(controlValue(row, '[data-ingredient-field="amount"]')),
        unit: controlValue(row, '[data-ingredient-field="unit"]'),
        note: controlValue(row, '[data-ingredient-field="note"]'),
      })),
      preparation: controlValue(meal, '[data-meal-field="preparation"]'),
      notes: controlValue(meal, '[data-meal-field="notes"]'),
      estimatedCaloriesKcal: (() => {
        const value = controlValue(meal, '[data-meal-field="estimatedCaloriesKcal"]');
        return value ? Number(value) : null;
      })(),
    }));
    serializedInput.value = JSON.stringify(entries);
  });
  refresh();
}

document.querySelectorAll<HTMLFormElement>('[data-diet-editor]').forEach(initializeEditor);
