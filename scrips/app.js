(function () {
  const app = window.RomanApp;
  const protectedPage = document.body.dataset.protected === 'true';
  const user = app.currentUser();
  if (protectedPage && !user) {
    window.location.replace('ingresar.html');
    return;
  }

  document.querySelectorAll('[data-user-name]').forEach(node => {
    if (user) node.textContent = user.name.split(' ')[0];
  });
  document.querySelectorAll('[data-auth="guest"]').forEach(node => { node.hidden = Boolean(user); });
  document.querySelectorAll('[data-auth="user"]').forEach(node => { node.hidden = !user; });
  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', () => {
    app.logout();
    window.location.href = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
  }));

  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (toggle && nav) toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}());
