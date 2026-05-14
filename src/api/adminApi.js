const adminApiUrl = "./api/admin.php";

export async function fetchAdminSession(request = fetch) {
  const response = await request(adminApiUrl, { cache: "no-store" });
  return response;
}

export async function loginAdminRequest(password, request = fetch) {
  return postAdminAction({ action: "login", password }, request);
}

export async function logoutAdminRequest(request = fetch) {
  return postAdminAction({ action: "logout" }, request);
}

export async function changeRegionalPasswordRequest(regionId, password, request = fetch) {
  return postAdminAction({ action: "change-region-password", regionId, password }, request);
}

async function postAdminAction(payload, request) {
  return request(adminApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
