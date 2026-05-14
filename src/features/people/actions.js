import { uniqueIds } from "../../../modules/data.js";

export function addDraftPersonAction(state, key, id) {
  state[key] = uniqueIds([...(state[key] || []), id]);
  return state[key];
}

export function removeDraftPersonAction(state, key, id) {
  state[key] = (state[key] || []).filter((personId) => personId !== id);
  if (key === "draftCrossMemberIds" && state[key].length === 0) {
    state.draftCrossGroupSize = 0;
  }
  return state[key];
}

export function removeExtraCeremonyAction(state, id) {
  state.draftCeremonyEvents = (state.draftCeremonyEvents || []).filter((item) => item.id !== id);
  return state.draftCeremonyEvents;
}

export function setAdminPersonSelectedAction(state, personId, isSelected) {
  state.adminSelectedPersonIds = isSelected
    ? uniqueIds([...state.adminSelectedPersonIds, personId])
    : state.adminSelectedPersonIds.filter((id) => id !== personId);
  return state.adminSelectedPersonIds;
}

export function toggleAdminSelectionAction(state, people, shouldSelectAll) {
  state.adminSelectedPersonIds = shouldSelectAll ? people.map((person) => person.id) : [];
  return state.adminSelectedPersonIds;
}

export function sanitiseAdminSelectionAction(state, people) {
  const validIds = new Set(people.map((person) => person.id));
  state.adminSelectedPersonIds = state.adminSelectedPersonIds.filter((id) => validIds.has(id));
  return state.adminSelectedPersonIds;
}
