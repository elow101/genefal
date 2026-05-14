const authApiUrl = "./api/auth.php";

export async function fetchAuthStatus(request = fetch) {
  const response = await request(authApiUrl, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    return { authenticated: false, csrfToken: "" };
  }
  const payload = await response.json();
  return {
    authenticated: payload?.authenticated === true,
    csrfToken: String(payload?.csrfToken || ""),
  };
}

export async function fetchCsrfToken(request = fetch) {
  const status = await fetchAuthStatus(request);
  return status.authenticated ? status.csrfToken : "";
}
