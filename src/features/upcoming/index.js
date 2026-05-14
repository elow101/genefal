import {
  fallbackId,
  normaliseDateTimeLocal,
  normaliseUpcomingEventType,
  normalisedText,
  toIdArray,
} from "../../../modules/data.js";
import { requestCountLabel, shouldKeepUpcomingEvent } from "../../../modules/announcements.js";
import { labelFromMap, labels } from "../../../modules/labels.js";
import { escapeHtml } from "../../ui/renderHelpers.js";

export function normaliseUpcomingBaptisms(input, now = new Date()) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input
    .map((item) => {
      const eventType = normaliseUpcomingEventType(item?.eventType || item?.type);
      const id = String(item?.id || `${eventType}-${fallbackId()}`).trim();
      const sponsorIds = toIdArray(item?.sponsorIds || (item?.sponsorId ? [item.sponsorId] : []));
      const fillotIds = toIdArray(item?.fillotIds || (item?.fillotId ? [item.fillotId] : []));
      const baptizedNames = normaliseUpcomingBaptizedNames(item?.baptizedNames || item?.baptisedNames || item?.fillotNames);
      const regionId = String(item?.regionId || "").trim();
      const dateTime = normaliseDateTimeLocal(item?.dateTime || (item?.date ? `${item.date}T00:00` : ""));
      if (!id || (!fillotIds.length && !baptizedNames.length) || !sponsorIds.length || !regionId || !dateTime || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        regionId,
        eventType,
        sponsorIds,
        fillotIds,
        baptizedNames,
        dateTime,
        place: String(item?.place || "").trim().slice(0, 160),
        message: String(item?.message || "").trim().slice(0, 600),
        createdAt: String(item?.createdAt || now.toISOString()).trim(),
        requests: normaliseUpcomingRequests(item?.requests || item?.responses, now),
      };
    })
    .filter(Boolean)
    .filter((event) => shouldKeepUpcomingEvent(event, (candidate) => isUpcomingBaptismExpired(candidate, now)))
    .sort(compareUpcomingBaptisms);
}

export function normaliseUpcomingBaptizedNames(input) {
  const source = Array.isArray(input) ? input : String(input || "").split(/[\n,;]+/);
  const byName = new Map();
  source.forEach((item) => {
    const name = String(item || "").trim().replace(/\s+/g, " ").slice(0, 120);
    if (name) byName.set(normalisedText(name), name);
  });
  return [...byName.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

export function normaliseUpcomingRequests(input, now = new Date()) {
  if (!Array.isArray(input)) return [];
  const byName = new Map();
  input.forEach((item) => {
    const name = String(item?.name || "").trim().slice(0, 90);
    const nickname = String(item?.nickname || "").trim().slice(0, 90);
    if (!name) return;
    byName.set(normalisedText(`${name} ${nickname}`), {
      id: String(item?.id || `demande-${fallbackId()}`).trim(),
      name,
      nickname,
      createdAt: String(item?.createdAt || now.toISOString()).trim(),
    });
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function compareUpcomingBaptisms(a, b) {
  return a.dateTime.localeCompare(b.dateTime) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function isUpcomingBaptismExpired(event, now = new Date()) {
  const date = parseDateTimeLocal(event.dateTime);
  if (!date) return false;
  const expiresAt = new Date(date);
  expiresAt.setDate(expiresAt.getDate() + 2);
  expiresAt.setHours(0, 0, 0, 0);
  return now >= expiresAt;
}

export function parseDateTimeLocal(value) {
  const normalised = normaliseDateTimeLocal(value);
  if (!normalised) return null;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatUpcomingDateTime(value) {
  if (!value) return "Date a confirmer";
  const date = parseDateTimeLocal(value);
  if (!date || Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function upcomingEventTypeLabel(value) {
  return labelFromMap(labels.upcomingEvent, normaliseUpcomingEventType(value), labels.upcomingEvent.bapteme);
}

export function renderUpcomingSponsorSelectionHtml({ sponsorIds, people, emptyText = "Aucun parrain ou marraine ajoute.", displayName, getPersonFromPeople }) {
  const selectedPeople = sponsorIds.map((id) => getPersonFromPeople(people, id)).filter(Boolean);
  const hiddenInputs = sponsorIds
    .map((id) => `<input type="hidden" name="sponsorIds" value="${escapeHtml(id)}" />`)
    .join("");
  const chips = selectedPeople.length
    ? selectedPeople
        .map(
          (person) =>
            `<button class="selected-chip" type="button" data-upcoming-sponsor-remove="${escapeHtml(person.id)}" title="Retirer">${escapeHtml(displayName(person))}<span aria-hidden="true">x</span></button>`
        )
        .join("")
    : `<small>${escapeHtml(emptyText)}</small>`;
  return `<div class="selected-chip-list upcoming-sponsor-list">${hiddenInputs}${chips}</div>`;
}

export function renderUpcomingConcernedSelectionHtml({ personIds, people, displayName, getPersonFromPeople }) {
  const selectedPeople = personIds.map((id) => getPersonFromPeople(people, id)).filter(Boolean);
  const hiddenInputs = personIds
    .map((id) => `<input type="hidden" name="fillotIds" value="${escapeHtml(id)}" />`)
    .join("");
  const chips = selectedPeople.length
    ? selectedPeople
        .map(
          (person) =>
            `<button class="selected-chip" type="button" data-upcoming-concerned-remove="${escapeHtml(person.id)}" title="Retirer">${escapeHtml(displayName(person))}<span aria-hidden="true">x</span></button>`
        )
        .join("")
    : `<small>Aucun faluchard ajoute.</small>`;
  return `<div class="selected-chip-list upcoming-sponsor-list">${hiddenInputs}${chips}</div>`;
}

export function renderUpcomingBaptismCardHtml({
  event,
  people,
  region,
  expandedUpcomingId = "",
  selectedEventIds = [],
  adminMode = false,
  displayName,
  getPersonFromPeople,
  uniqueNames,
  cooptageRoleLabelForRegion,
}) {
  const fillots = event.fillotIds.map((id) => getPersonFromPeople(people, id)).filter(Boolean);
  const baptizedNames = uniqueNames([...(event.baptizedNames || []), ...fillots.map(displayName)]);
  const sponsors = event.sponsorIds.map((id) => getPersonFromPeople(people, id)).filter(Boolean);
  const isExpanded = expandedUpcomingId === event.id;
  const isSelected = selectedEventIds.includes(event.id);
  const requesterCount = event.requests.length;
  const typeLabel = upcomingEventTypeLabel(event.eventType);
  const isCooptage = normaliseUpcomingEventType(event.eventType) === "cooptage";
  const peopleLabel = isCooptage ? "Faluchard inconnu" : "Baptise inconnu";
  const sponsorLabel = isCooptage ? cooptageRoleLabelForRegion(region) : "P/M";
  return `<article class="upcoming-card${isExpanded ? " is-expanded" : ""}">
    <label class="upcoming-card-check">
      <input type="checkbox" data-upcoming-select value="${escapeHtml(event.id)}" ${isSelected ? "checked" : ""} />
      <span>${isSelected ? "Demande a venir" : "Selectionner"}</span>
    </label>
    <button class="upcoming-card-main" type="button" data-upcoming-toggle="${escapeHtml(event.id)}">
      <span>
        <strong>${escapeHtml(baptizedNames.join(", ") || peopleLabel)}</strong>
        <small>${escapeHtml(typeLabel)} - ${escapeHtml(formatUpcomingDateTime(event.dateTime))}${event.place ? ` - ${escapeHtml(event.place)}` : ""}</small>
        <small>${sponsorLabel} : ${escapeHtml(sponsors.map(displayName).join(", ") || "non renseigne")}</small>
      </span>
      <em>${escapeHtml(requestCountLabel(requesterCount))}</em>
    </button>
    <div class="upcoming-card-actions">
      ${adminMode ? `<button class="text-button danger-text" type="button" data-upcoming-delete="${escapeHtml(event.id)}">Supprimer</button>` : ""}
    </div>
    ${event.message ? `<p>${escapeHtml(event.message)}</p>` : ""}
    ${isExpanded ? `<div class="upcoming-requests">
      <strong>Demandes a venir</strong>
      ${
        event.requests.length
          ? event.requests.map((request) => `<span>${escapeHtml(request.name)}${request.nickname ? ` dit ${escapeHtml(request.nickname)}` : ""}</span>`).join("")
          : `<small>Aucune demande pour le moment.</small>`
      }
    </div>` : ""}
  </article>`;
}
