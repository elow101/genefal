export const labels = {
  empty: {
    unknownFiliere: "Non renseignee",
  },
  ceremony: {
    bapteme: "Bapteme",
    adoption: "Adoption",
    confirmation: "Confirmation",
  },
  upcomingEvent: {
    bapteme: "Bapteme",
    adoption: "Adoption",
    confirmation: "Confirmation",
    cooptage: "Cooptage",
  },
  doleanceType: {
    bug: "Bug",
    retrait: "Demande de retrait",
    modification: "Demande de modification",
    autre: "Autre",
  },
  serverStatus: {
    saved: "Sauvegardé",
    saving: "Sauvegarde en cours",
    offline: "Hors ligne",
    error: "Erreur",
  },
};

export function labelFromMap(map, value, fallback) {
  return map[value] || fallback;
}

export function labelFromId(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
