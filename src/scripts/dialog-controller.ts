const openerByDialog = new WeakMap<HTMLDialogElement, HTMLElement>();

/** Guardar el disparador permite devolver el foco al cerrar, incluso con varios diálogos en la vista. */

document.querySelectorAll<HTMLElement>("[data-dialog-open]").forEach((opener) => {
  if (opener.dataset.dialogReady === "true") return;

  const targetId = opener.dataset.dialogOpen?.replace(/^#/, "");
  const dialog = targetId ? document.getElementById(targetId) : null;
  if (!(dialog instanceof HTMLDialogElement)) return;

  opener.dataset.dialogReady = "true";
  opener.setAttribute("aria-controls", dialog.id);
  opener.setAttribute("aria-haspopup", "dialog");

  opener.addEventListener("click", () => {
    openerByDialog.set(dialog, opener);
    opener.setAttribute("aria-expanded", "true");
    if (!dialog.open) dialog.showModal();

    requestAnimationFrame(() => {
      dialog
        .querySelector<HTMLElement>("[autofocus], [data-dialog-initial-focus]")
        ?.focus();
    });
  });
});

document.querySelectorAll<HTMLDialogElement>("dialog[data-app-dialog]").forEach((dialog) => {
  if (dialog.dataset.dialogReady === "true") return;
  dialog.dataset.dialogReady = "true";

  dialog.querySelectorAll<HTMLElement>("[data-dialog-close]").forEach((closer) => {
    closer.addEventListener("click", () => {
      if (dialog.open) dialog.close(closer.dataset.dialogValue ?? "cancel");
    });
  });

  dialog.addEventListener("pointerdown", (event) => {
    if (event.target === dialog) dialog.close("backdrop");
  });

  dialog.addEventListener("close", () => {
    const opener = openerByDialog.get(dialog);
    opener?.setAttribute("aria-expanded", "false");
    opener?.focus();
    openerByDialog.delete(dialog);
  });
});
