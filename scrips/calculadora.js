(function () {
  const form = document.querySelector('[data-calorie-form]');
  const result = document.querySelector('[data-calorie-result]');
  form.addEventListener('submit', event => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); const bmr = data.sex === 'male' ? 10 * data.weight + 6.25 * data.height - 5 * data.age + 5 : 10 * data.weight + 6.25 * data.height - 5 * data.age - 161; const calories = Math.round(bmr * Number(data.activity)); result.innerHTML = `<strong>${calories.toLocaleString('es-MX')} kcal</strong><span>Estimación de mantenimiento diario · metabolismo basal: ${Math.round(bmr)} kcal.</span>`; RomanApp.updateCurrentUser(user => { user.data.calorieHistory.unshift({ calories, bmr:Math.round(bmr), date:new Date().toISOString() }); user.data.calorieHistory = user.data.calorieHistory.slice(0, 10); return user; }); });
}());
