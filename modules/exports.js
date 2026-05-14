export function wrappedLines(value, maxChars, maxLines) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = visible[visible.length - 1] || "";
  visible[visible.length - 1] = last.length > maxChars - 3 ? `${last.slice(0, Math.max(0, maxChars - 3))}...` : `${last}...`;
  return visible;
}
