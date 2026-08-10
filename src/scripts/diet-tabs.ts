const tabList = document.querySelector<HTMLElement>('[data-diet-tabs]');

if (tabList) {
  const tabs = [...tabList.querySelectorAll<HTMLAnchorElement>('[data-diet-tab]')];
  const panels = [...document.querySelectorAll<HTMLElement>('[data-diet-panel]')];
  const activate = (name: string, updateHistory: boolean): void => {
    if (!tabs.some((tab) => tab.dataset.dietTab === name)) return;
    tabs.forEach((tab) => {
      const active = tab.dataset.dietTab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle('is-active', active);
    });
    panels.forEach((panel) => {
      const active = panel.dataset.dietPanel === name;
      panel.hidden = !active;
      panel.tabIndex = active ? 0 : -1;
    });
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', name);
      history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      activate(tab.dataset.dietTab ?? 'ai', true);
    });
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      if (next) {
        activate(next.dataset.dietTab ?? 'ai', true);
        next.focus();
      }
    });
  });
}
