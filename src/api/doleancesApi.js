const doleancesApiUrl = "./api/doleances.php";

export function fetchDoleancesRequest(request = fetch) {
  return request(doleancesApiUrl, { cache: "no-store" });
}

export function createDoleanceRequest(payload, request = fetch) {
  return request(doleancesApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function saveDoleancesRequest(doleances, request = fetch) {
  return request(doleancesApiUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doleances }),
  });
}
