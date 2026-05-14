export function stripAccents(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function fallbackId(prefix = "person") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeId(value, fallbackPrefix = "person") {
  return (
    stripAccents(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || fallbackId(fallbackPrefix)
  );
}

export function normalisedText(value) {
  return stripAccents(String(value || "")).toLowerCase().trim();
}

export function uniqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean).map(String))];
}

export function toIdArray(value) {
  return Array.isArray(value) ? uniqueIds(value.map(String)) : [];
}

export function normaliseRoleId(value) {
  const raw = String(value || "").trim();
  return raw ? makeId(raw) : "";
}

export function normaliseRoles(value) {
  return uniqueIds(toIdArray(value).map(normaliseRoleId)).filter(Boolean);
}

export function normaliseNicknames(value, fallback = "") {
  const source = Array.isArray(value) ? value : [fallback];
  return uniqueIds(source.map((item) => String(item || "").trim())).slice(0, 3);
}

export function normaliseBaptismStatus(value) {
  return value === "unbaptized" ? "unbaptized" : "unknown";
}

export function normaliseCrossGroupSize(value, maxCrossGroupSize = 10) {
  const size = Number(value);
  return size >= 2 && size <= maxCrossGroupSize ? size : 0;
}

export function normaliseUpcomingEventType(value) {
  const type = normalisedText(value);
  if (type === "cooptage") return "cooptage";
  if (type === "adoption") return "adoption";
  if (type === "confirmation") return "confirmation";
  return "bapteme";
}

export function normaliseDateTimeLocal(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s)(\d{2}:\d{2})/);
  if (match) return `${match[1]}T${match[2]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00`;
  return "";
}

export function readDepth(value, fallback = 20, max = 20) {
  const depth = Number(value);
  if (!Number.isFinite(depth)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(depth)));
}
