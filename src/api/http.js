export function canUseRemoteApi(location = window.location) {
  return location.protocol === "http:" || location.protocol === "https:";
}

export async function readResponseMessage(response) {
  try {
    const text = await response.text();
    if (!text) return `HTTP ${response.status}`;
    const payload = JSON.parse(text);
    return payload.error || text.slice(0, 300);
  } catch {
    return `HTTP ${response.status}`;
  }
}

