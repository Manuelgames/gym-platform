(function () {
  const form = document.querySelector('[data-diet-form]');
  const title = document.querySelector('[data-diet-title]');
  const summary = document.querySelector('[data-diet-summary]');
  const output = document.querySelector('[data-diet-output]');
  const plans = {
    general: [
      ['Desayuno', 'Avena con yogur natural, fruta de temporada y nueces.'],
      ['Comida', 'Pollo, pescado o legumbres con arroz/patata, verduras y aceite de oliva.'],
      ['Cena', 'Huevos, tofu o pescado con verduras y una porción de carbohidrato integral.'],
      ['Colación', 'Fruta, yogur, semillas o un puñado de frutos secos.'],
      ['Antes de dormir', 'Leche, yogur o queso fresco con fruta si tu hambre lo pide.']
    ],
    vegetariana: [
      ['Desayuno', 'Avena con bebida vegetal, fruta y crema de cacahuate.'],
      ['Comida', 'Lentejas o garbanzos con quinoa, verduras y aceite de oliva.'],
      ['Cena', 'Tofu o huevos con papa asada y ensalada de colores.'],
      ['Colación', 'Yogur, fruta y un puñado de nueces.'],
      ['Antes de dormir', 'Bebida vegetal o yogur con semillas, según tu apetito.']
    ],
    rapida: [
      ['Desayuno', 'Yogur griego, avena instantánea, plátano y canela.'],
      ['Comida', 'Tortillas integrales con pollo o frijoles, ensalada lista y aguacate.'],
      ['Cena', 'Huevos revueltos con verduras congeladas y pan integral.'],
      ['Colación', 'Fruta, queso fresco o mezcla de nueces.'],
      ['Antes de dormir', 'Yogur natural o un vaso de leche con fruta.']
    ]
  };
  const goals = { ganar:'Construir fuerza', mantener:'Sostener tu energía', perder:'Navegar hacia un déficit moderado' };
  function render(plan) {
    if (!plan) return;
    title.textContent = goals[plan.goal];
    summary.textContent = `${plan.meals} comidas al día · ${plan.preference === 'rapida' ? 'opciones prácticas' : plan.preference}. Ajusta porciones según tu hambre, entrenamiento y recomendación profesional.`;
    output.innerHTML = plans[plan.preference].slice(0, Number(plan.meals)).map(([meal, text]) => `<article class="meal"><h3>${meal}</h3><p>${text}</p></article>`).join('');
  }
  const existing = RomanApp.currentUser().data.diet;
  if (existing) { form.elements.goal.value = existing.goal; form.elements.preference.value = existing.preference; form.elements.meals.value = existing.meals; render(existing); }
  form.addEventListener('submit', event => { event.preventDefault(); const plan = Object.fromEntries(new FormData(form)); plan.createdAt = new Date().toISOString(); RomanApp.updateCurrentUser(user => { user.data.diet = plan; return user; }); render(plan); });
}());
