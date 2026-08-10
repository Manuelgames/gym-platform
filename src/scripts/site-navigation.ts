// El módulo de especialistas añadió rutas; el menú colapsa antes de apretarlas.
const MOBILE_QUERY = "(max-width: 900px)";

document.querySelectorAll<HTMLElement>("[data-site-header]").forEach((header) => {
  if (header.dataset.navigationReady === "true") return;

  const toggle = header.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const navigation = header.querySelector<HTMLElement>("[data-site-nav]");
  if (!toggle || !navigation) return;
  const menus = [...navigation.querySelectorAll<HTMLDetailsElement>("[data-nav-menu]")];

  header.dataset.navigationReady = "true";
  const media = window.matchMedia(MOBILE_QUERY);

  /** Mantiene sincronizados el estado visual y la información anunciada por lectores de pantalla. */
  const setOpen = (open: boolean, returnFocus = false) => {
    navigation.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    if (returnFocus) toggle.focus();
  };
  const closeMenus = () => menus.forEach((menu) => { menu.open = false; });

  // Solo un panel puede permanecer abierto para evitar que se superpongan.
  menus.forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      menus.forEach((otherMenu) => {
        if (otherMenu !== menu) otherMenu.open = false;
      });
    });
  });

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  navigation.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setOpen(false);
      closeMenus();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && !header.contains(event.target)) {
      if (media.matches) setOpen(false);
      closeMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const hadOpenMenu = menus.some((menu) => menu.open);
      if (toggle.getAttribute("aria-expanded") === "true") setOpen(false, true);
      if (hadOpenMenu) closeMenus();
    }
  });

  media.addEventListener("change", (event) => {
    if (!event.matches) setOpen(false);
    closeMenus();
  });
});
