export const storageKeys = {
  genealogy: "genealogie-faluche-v1",
  doleances: "genealogie-faluche-doleances-v1",
  recentPeople: "genealogie-faluche-recent-people-v1",
  formDraft: "genealogie-faluche-form-draft-v1",
};

export function createAppState({
  initialGenealogyState,
  activePeople,
  recentPersonIds = [],
  doleances = [],
  overrides = {},
}) {
  const people = activePeople(initialGenealogyState);
  return {
    genealogies: initialGenealogyState.genealogies,
    activeGenealogyId: initialGenealogyState.activeGenealogyId,
    people,
    upcomingBaptisms: initialGenealogyState.upcomingBaptisms,
    formTargetGenealogyId: initialGenealogyState.activeGenealogyId,
    selectedId: null,
    query: "",
    mode: "tree",
    baptismTimelinePeriod: "month",
    baptismTimelineMonthKey: "",
    graphZoom: 1,
    ancestorDepth: 20,
    descendantDepth: 20,
    showEditor: true,
    adminMode: false,
    adminLevel: "",
    adminRegionId: "",
    adminRequiresPasswordChange: false,
    adminRegions: [],
    adminRecentChanges: [],
    adminSelectedPersonIds: [],
    serverStatus: "offline",
    publicEditablePersonIds: [],
    recentPersonIds,
    userSelectedGenealogy: false,
    expandedGenealogyRegionId: "",
    upcomingSponsorIds: [],
    upcomingConcernedIds: [],
    upcomingSelectedEventIds: [],
    showUpcomingAnnouncementForm: false,
    upcomingAnnouncementKind: "ceremony",
    upcomingAnnouncementDraft: {},
    expandedUpcomingId: "",
    expandedStatKey: null,
    doleances,
    doleancePanelOpen: false,
    remoteReady: false,
    csrfToken: "",
    pendingGenealogyPhotoId: null,
    prefillSponsorIds: [],
    formPersonId: null,
    formDirty: false,
    formEditRevision: 0,
    draftSponsorIds: [],
    draftHeartSponsorIds: [],
    draftCeremonyEvents: [],
    draftCrossMemberIds: [],
    draftCrossGroupSize: 0,
    ...overrides,
  };
}

export function loadStoredGenealogyState({ storage = globalThis.localStorage, normaliseGenealogyState, key = storageKeys.genealogy } = {}) {
  try {
    return normaliseGenealogyState(JSON.parse(storage.getItem(key) || "[]"));
  } catch {
    return normaliseGenealogyState([]);
  }
}

export function loadStoredRecentPersonIds({
  storage = globalThis.localStorage,
  normaliseRecentPersonEntries,
  key = storageKeys.recentPeople,
} = {}) {
  try {
    return normaliseRecentPersonEntries(JSON.parse(storage.getItem(key) || "[]"));
  } catch {
    return [];
  }
}

export function saveStoredRecentPersonIds(recentPersonIds, { storage = globalThis.localStorage, key = storageKeys.recentPeople } = {}) {
  storage.setItem(key, JSON.stringify(recentPersonIds.slice(0, 8)));
}

export function saveStoredGenealogyState(payload, { storage = globalThis.localStorage, key = storageKeys.genealogy } = {}) {
  storage.setItem(key, JSON.stringify(payload));
}

export function loadStoredJson({ storage = globalThis.localStorage, key, fallback }) {
  try {
    return JSON.parse(storage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

export function saveStoredJson(value, { storage = globalThis.localStorage, key }) {
  storage.setItem(key, JSON.stringify(value));
}

export function removeStoredValue({ storage = globalThis.localStorage, key }) {
  storage.removeItem(key);
}

export const createBaseState = createAppState;

export function createGenealogyIndex(
  genealogies,
  { cache, isMainGenealogy = () => false, isRegionalGenealogy = () => false, isFamilyGenealogy = () => false } = {}
) {
  const source = Array.isArray(genealogies) ? genealogies : [];
  const cached = cache?.get(source);
  if (cached) return cached;

  const byId = new Map();
  const childrenByParentId = new Map();
  let main = null;
  source.forEach((genealogy) => {
    if (!genealogy?.id) return;
    byId.set(genealogy.id, genealogy);
    if (!main && isMainGenealogy(genealogy)) main = genealogy;
    const parentId = genealogy.parentId || "";
    if (parentId) {
      if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, []);
      childrenByParentId.get(parentId).push(genealogy);
    }
  });

  const regions = source.filter(isRegionalGenealogy).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const families = source.filter(isFamilyGenealogy).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const familiesByParentId = new Map();
  families.forEach((family) => {
    const parentId = family.parentId || "";
    if (!familiesByParentId.has(parentId)) familiesByParentId.set(parentId, []);
    familiesByParentId.get(parentId).push(family);
  });

  const index = { byId, childrenByParentId, familiesByParentId, regions, families, main };
  cache?.set(source, index);
  return index;
}

export function activePeopleFromGenealogyState(genealogyState, options = {}) {
  return createGenealogyIndex(genealogyState.genealogies, options).byId.get(genealogyState.activeGenealogyId)?.people || [];
}

export function activeGenealogyFromState(state, options = {}) {
  return createGenealogyIndex(state.genealogies, options).byId.get(state.activeGenealogyId) || state.genealogies[0];
}

export function mainGenealogyFromState(state, options = {}) {
  return createGenealogyIndex(state.genealogies, options).main || state.genealogies[0];
}

export function regionalGenealogyFor(
  genealogy,
  { genealogyById = () => null, isMainGenealogy = () => false, isRegionalGenealogy = () => false } = {}
) {
  if (!genealogy || isMainGenealogy(genealogy)) return null;
  if (isRegionalGenealogy(genealogy)) return genealogy;
  const parent = genealogyById(genealogy.parentId);
  return parent && isRegionalGenealogy(parent) ? parent : null;
}

export function childGenealogiesFor(parentId, { genealogyIndex }) {
  return [...(genealogyIndex.childrenByParentId.get(parentId) || [])];
}

export function regionalScopeGenealogiesFor(
  genealogy,
  {
    regionalGenealogyFor = () => null,
    childGenealogies = () => [],
    isRegionalGenealogy = () => false,
    isFamilyGenealogy = () => false,
  } = {}
) {
  const region = regionalGenealogyFor(genealogy) || (isRegionalGenealogy(genealogy) ? genealogy : null);
  if (!region) return [];
  return [region, ...childGenealogies(region.id).filter(isFamilyGenealogy)];
}
