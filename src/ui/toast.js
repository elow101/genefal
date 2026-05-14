export const toastTypes = {
  info: "info",
  success: "success",
  error: "error",
};

export function createToastController({ toastStack, documentRef = globalThis.document, windowRef = globalThis.window } = {}) {
  return {
    showToast(message, type = toastTypes.info) {
      if (!toastStack || !documentRef) return;
      const toast = documentRef.createElement("div");
      toast.className = `toast${type === toastTypes.error ? " is-error" : ""}`;
      toast.textContent = message;
      toastStack.append(toast);
      windowRef?.setTimeout?.(() => toast.remove(), 4200);
    },
  };
}
