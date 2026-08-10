(function () {
  const user = RomanApp.currentUser();
  if (!user) return;
  const exerciseCount = Object.values(user.data.routine).flat().length;
  document.querySelector('[data-routine-count]').textContent = exerciseCount;
  document.querySelector('[data-diet-status]').textContent = user.data.diet ? '1' : '—';
  document.querySelector('[data-calorie-count]').textContent = user.data.calorieHistory.length;
}());
