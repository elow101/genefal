const escapeHtmlMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => escapeHtmlMap[character]);
}

export function joinHtml(items, renderItem) {
  return items.map(renderItem).join("");
}
