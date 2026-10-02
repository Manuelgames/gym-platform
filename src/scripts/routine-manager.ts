const managers = new Map<string, HTMLElement>();
const choices = [...document.querySelectorAll<HTMLButtonElement>('[data-manager-choice][data-manager-target]')];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const synchronizeChoices = (manager: HTMLElement, name: string): void => {
  choices.forEach((choice) => {
    if (choice.dataset.managerTarget !== manager.id) return;
    choice.setAttribute('aria-pressed', String(choice.dataset.managerChoice === name));
  });
};

const reveal = (manager: HTMLElement, name: string, scroll = false): void => {
  const panels = [...manager.querySelectorAll<HTMLElement>('[data-manager-panel]')];
  if (!panels.some((panel) => panel.dataset.managerPanel === name)) return;

  panels.forEach((panel) => {
    const active = panel.dataset.managerPanel === name;
    panel.hidden = !active;
    panel.toggleAttribute('inert', !active);
  });
  manager.dataset.activeManagerPanel = name;
  manager.classList.add('is-open');
  manager.setAttribute('aria-hidden', 'false');
  synchronizeChoices(manager, name);

  if (!scroll) return;
  window.setTimeout(() => {
    const bounds = manager.getBoundingClientRect();
    if (bounds.top < 0 || bounds.top > window.innerHeight * .72) {
      manager.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, prefersReducedMotion ? 0 : 180);
};

document.querySelectorAll<HTMLElement>('[data-routine-manager]').forEach((manager) => {
  if (!manager.id || manager.dataset.managerReady === 'true') return;
  manager.dataset.managerReady = 'true';
  managers.set(manager.id, manager);
  manager.querySelectorAll<HTMLElement>('[data-manager-panel]').forEach((panel) => {
    panel.hidden = true;
    panel.setAttribute('inert', '');
  });
  const initialPanel = manager.dataset.initialManagerPanel;
  if (initialPanel) reveal(manager, initialPanel);
});

choices.forEach((choice) => {
  if (choice.dataset.managerChoiceReady === 'true') return;
  choice.dataset.managerChoiceReady = 'true';
  const managerId = choice.dataset.managerTarget;
  const panelName = choice.dataset.managerChoice;
  if (!managerId || !panelName) return;
  choice.setAttribute('aria-controls', managerId);
  choice.setAttribute('aria-pressed', String(managers.get(managerId)?.dataset.activeManagerPanel === panelName));
  choice.addEventListener('click', () => {
    const manager = managers.get(managerId);
    if (!manager) return;
    const dialog = choice.closest('dialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close(panelName);
    reveal(manager, panelName, true);
  });
});

export {};
