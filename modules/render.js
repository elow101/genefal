export function joinHtml(items, renderItem) {
  return items.map(renderItem).join("");
}
