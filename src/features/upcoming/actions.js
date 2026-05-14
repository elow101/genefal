import { normaliseDateTimeLocal, normaliseUpcomingEventType, uniqueIds } from "../../../modules/data.js";

export function addUpcomingSponsorAction(state, personId) {
  state.upcomingSponsorIds = uniqueIds([...state.upcomingSponsorIds, personId]);
  state.upcomingAnnouncementDraft.sponsorSearch = "";
  return state.upcomingSponsorIds;
}

export function addUpcomingConcernedAction(state, personId) {
  state.upcomingConcernedIds = uniqueIds([...state.upcomingConcernedIds, personId]);
  state.upcomingAnnouncementDraft.concernedSearch = "";
  return state.upcomingConcernedIds;
}

export function removeUpcomingSponsorAction(state, personId) {
  state.upcomingSponsorIds = state.upcomingSponsorIds.filter((id) => id !== personId);
  return state.upcomingSponsorIds;
}

export function removeUpcomingConcernedAction(state, personId) {
  state.upcomingConcernedIds = state.upcomingConcernedIds.filter((id) => id !== personId);
  return state.upcomingConcernedIds;
}

export function captureUpcomingAnnouncementDraftAction(state, form, FormDataCtor = globalThis.FormData) {
  if (!form) return state.upcomingAnnouncementDraft;
  const data = new FormDataCtor(form);
  const type = normaliseUpcomingEventType(data.get("eventType"));
  const kind = type === "cooptage" || form?.dataset.upcomingKind === "cooptage" ? "cooptage" : "ceremony";
  state.upcomingAnnouncementDraft = {
    eventType: type,
    sponsorSearch: String(form.querySelector("[data-upcoming-sponsor-search]")?.value || "").trim(),
    concernedSearch: String(form.querySelector("[data-upcoming-concerned-search]")?.value || "").trim(),
    baptizedNames: String(data.get("baptizedNames") || ""),
    dateTime: normaliseDateTimeLocal(data.get("dateTime")),
    place: String(data.get("place") || "").trim(),
    message: String(data.get("message") || "").trim(),
    kind,
  };
  state.upcomingAnnouncementKind = kind;
  return state.upcomingAnnouncementDraft;
}
