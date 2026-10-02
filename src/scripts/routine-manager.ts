document.querySelectorAll<HTMLElement>('[data-routine-manager]').forEach((manager) => {
  if (manager.dataset.managerReady === 'true') return;
  manager.dataset.managerReady = 'true';
  const tabs = [...manager.querySelectorAll<HTMLButtonElement>('[data-manager-tab]')];
  const panels = [...manager.querySelectorAll<HTMLElement>('[data-manager-panel]')];
  const activate = (name: string): void => {
    tabs.forEach((tab) => {
      const active = tab.dataset.managerTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.managerPanel !== name; });
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab.dataset.managerTab ?? 'generation'));
  });
  activate(manager.dataset.initialManagerTab ?? 'generation');
});

export {};
