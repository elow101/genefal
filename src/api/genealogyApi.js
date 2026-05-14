const genealogyApiUrl = "./api/genealogy.php";

export function fetchGenealogyRequest(request = fetch) {
  return request(genealogyApiUrl, { cache: "no-store" });
}

export function saveGenealogyRequest(payload, request = fetch) {
  return request(genealogyApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function genealogySavePayload({ roleResetVersion, activeGenealogyId, genealogies, upcomingBaptisms }) {
  return {
    roleResetVersion,
    activeGenealogyId,
    genealogies,
    upcomingBaptisms,
  };
}
