export function compareByFrenchLabel(a, b) {
  return String(a || "").localeCompare(String(b || ""), "fr");
}
