(function () {
  const app = window.RomanApp;
  const form = document.querySelector('form');
  const message = document.querySelector('[data-form-message]');
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    if (form.dataset.mode === 'register') {
      const result = app.register(values);
      if (!result.ok) return show('Ese correo ya forma parte del imperio. Inicia sesión o usa otro.', true);
      window.location.href = 'menu.html';
      return;
    }
    const result = app.login(values.email, values.password);
    if (!result.ok) return show(result.reason === 'email' ? 'No encontramos ese correo.' : 'La contraseña no coincide.', true);
    window.location.href = 'menu.html';
  });
  function show(text, error) {
    message.textContent = text;
    message.classList.toggle('is-error', error);
    message.hidden = false;
  }
}());
