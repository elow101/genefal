export function applyAdminSessionAction(state, session, normaliseAdminSession) {
  const nextSession = normaliseAdminSession(session);
  state.adminLevel = nextSession?.level || "";
  state.adminRegionId = nextSession?.regionId || "";
  state.adminRequiresPasswordChange = Boolean(nextSession?.requiresPasswordChange);
  state.adminRegions = nextSession?.regions || [];
  state.adminRecentChanges = nextSession?.recentChanges || [];
  return nextSession;
}
