import { escapeHtml } from "./renderHelpers.js";

export const modalSelectors = {
  root: "[data-app-modal]",
  confirm: "[data-modal-confirm]",
  cancel: "[data-modal-cancel]",
};

export function createModalController({ modalRoot } = {}) {
  return {
    showAppModal({ title, message = "", fields = [], confirmText = "OK", cancelText = "", danger = false, requiredText = "" }) {
      return new Promise((resolve) => {
        if (!modalRoot) {
          resolve({ confirmed: true, values: {} });
          return;
        }

        const root = modalRoot;
        root.className = "app-modal-root is-open";
        const fieldHtml = fields
          .map((field) => `<label>${escapeHtml(field.label)}
            <input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" value="${escapeHtml(field.value || "")}" autocomplete="${field.type === "password" ? "new-password" : "off"}" ${field.required ? "required" : ""} />
          </label>`)
          .join("");
        const requiredHtml = requiredText
          ? `<label>Confirmation
              <input name="__requiredText" autocomplete="off" placeholder="${escapeHtml(requiredText)}" required />
              <span class="field-hint">Tape exactement ${escapeHtml(requiredText)} pour confirmer.</span>
            </label>`
          : "";
        root.innerHTML = `<form class="app-modal${danger ? " app-modal-danger" : ""}" role="dialog" aria-modal="true">
          <h2>${escapeHtml(title)}</h2>
          <div class="app-modal-body">
            ${message ? `<p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>` : ""}
            ${fieldHtml}
            ${requiredHtml}
          </div>
          <div class="app-modal-actions">
            ${cancelText ? `<button class="text-button" type="button" data-modal-cancel>${escapeHtml(cancelText)}</button>` : ""}
            <button class="${danger ? "text-button danger-text" : "primary"}" type="submit">${escapeHtml(confirmText)}</button>
          </div>
        </form>`;

        const form = root.querySelector("form");
        const firstInput = root.querySelector("input");
        firstInput?.focus();

        const close = (confirmed, values = {}) => {
          root.removeEventListener("click", onBackdrop);
          root.className = "app-modal-root";
          root.innerHTML = "";
          resolve({ confirmed, values });
        };
        const onBackdrop = (event) => {
          if (event.target !== root) return;
          close(false);
        };

        root.querySelector("[data-modal-cancel]")?.addEventListener("click", () => close(false));
        root.addEventListener("click", onBackdrop);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const data = new FormData(form);
          if (requiredText && String(data.get("__requiredText") || "") !== requiredText) return;
          close(true, Object.fromEntries(data.entries()));
        });
      });
    },
  };
}

export function createDialogService({ modalController, toastController }) {
  const showAppModal = modalController.showAppModal;
  const showToast = toastController.showToast;
  return {
    showToast,
    showAppModal,
    async showMessage(title, message, type = "info") {
      if (type === "toast") {
        showToast(message);
        return;
      }
      await showAppModal({ title, message, confirmText: "OK" });
    },
    async askConfirm(title, message, options = {}) {
      const result = await showAppModal({
        title,
        message,
        confirmText: options.confirmText || "Confirmer",
        cancelText: options.cancelText || "Annuler",
        danger: Boolean(options.danger),
        requiredText: options.requiredText || "",
      });
      return result.confirmed;
    },
    async askText(title, message, options = {}) {
      const result = await showAppModal({
        title,
        message,
        fields: [{ name: "value", label: options.label || title, value: options.value || "", type: options.type || "text", required: Boolean(options.required) }],
        confirmText: options.confirmText || "Valider",
        cancelText: options.cancelText || "Annuler",
        danger: Boolean(options.danger),
      });
      return result.confirmed ? String(result.values.value || "") : null;
    },
  };
}
