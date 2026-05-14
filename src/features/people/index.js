import {
  fallbackId,
  makeId,
  normaliseBaptismStatus,
  normaliseCrossGroupSize as dataNormaliseCrossGroupSize,
  normaliseNicknames,
  normaliseRoles,
  normalisedText,
  toIdArray,
  uniqueIds,
} from "../../../modules/data.js";

export function normalisePeople(input, { normaliseFiliere = () => "", maxCrossGroupSize = 10 } = {}) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const people = input
    .map((item) => {
      const nicknames = normaliseNicknames(item.nicknames, item.nickname);
      const baptismCity = String(item.baptismCity || item.ceremonyCity || "").trim();
      const legacyType = normalisedText(item.ceremonyType);
      const legacyEvents =
        ["adoption", "confirmation"].includes(legacyType) && baptismCity
          ? [{ type: legacyType, city: baptismCity, sponsorIds: item.sponsorIds }]
          : [];
      const ceremonyEvents = normaliseCeremonyEvents([...(Array.isArray(item.ceremonyEvents) ? item.ceremonyEvents : []), ...legacyEvents]);
      return {
        id: String(item.id || makeId(item.name || fallbackId())),
        name: String(item.name || "").trim(),
        nickname: nicknames[0] || "",
        nicknames,
        roles: normaliseRoles(item.roles),
        ceremonyType: normaliseCeremonyType(item.ceremonyType),
        baptismDate: String(item.baptismDate || "").trim(),
        baptismCity,
        baptismStatus: normaliseBaptismStatus(item.baptismStatus),
        ceremonyEvents,
        song: String(item.song || "").trim(),
        filiere: normaliseFiliere(item.filiere),
        photoData: "",
        createdAt: String(item.createdAt || item.addedAt || "").trim(),
        sponsorIds: toIdArray(item.sponsorIds),
        heartSponsorIds: toIdArray(item.heartSponsorIds),
        crossGroupId: String(item.crossGroupId || "").trim(),
        crossGroupSize: normaliseCrossGroupSize(item.crossGroupSize, maxCrossGroupSize),
      };
    })
    .filter((item) => item.id && item.name)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map((item) => ({
      ...item,
      sponsorIds: item.sponsorIds.filter((id) => id !== item.id),
      heartSponsorIds: item.heartSponsorIds.filter((id) => id !== item.id),
      ceremonyEvents: item.ceremonyEvents.map((event) => ({
        ...event,
        sponsorIds: event.sponsorIds.filter((id) => id !== item.id),
      })),
    }));

  return normaliseCrossGroups(
    people.map((person) => {
      const sponsorIds = uniqueIds([...person.sponsorIds, ...person.heartSponsorIds]);
      return {
        ...person,
        sponsorIds,
        heartSponsorIds: uniqueIds(person.heartSponsorIds).filter((id) => sponsorIds.includes(id)),
      };
    }),
    maxCrossGroupSize
  );
}

export function normaliseCrossGroups(people, maxCrossGroupSize = 10) {
  const counts = new Map();
  people.forEach((person) => {
    if (person.ceremonyType !== "bapteme" || !person.crossGroupId) return;
    counts.set(person.crossGroupId, (counts.get(person.crossGroupId) || 0) + 1);
  });

  return people.map((person) => {
    const count = counts.get(person.crossGroupId) || 0;
    if (count < 2 || count > maxCrossGroupSize || person.ceremonyType !== "bapteme") {
      return { ...person, crossGroupId: "", crossGroupSize: 0 };
    }
    return { ...person, crossGroupSize: count };
  });
}

export function normaliseCeremonyType() {
  return "bapteme";
}

export function normaliseCeremonyEvents(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const rawType = normalisedText(item?.type || item?.ceremonyType || item?.eventType);
      const type = rawType === "confirmation" ? "confirmation" : rawType === "adoption" ? "adoption" : "";
      const city = String(item?.city || item?.baptismCity || item?.ceremonyCity || "").trim();
      const nickname = String(item?.nickname || item?.adoptionNickname || item?.confirmationNickname || "").trim().slice(0, 90);
      const sponsorIds = toIdArray(
        item?.sponsorIds ||
          item?.adoptionSponsorIds ||
          item?.confirmationSponsorIds ||
          (item?.sponsorId ? [item.sponsorId] : [])
      );
      if (!type || !city) return null;
      return {
        id: String(item?.id || `${type}-${fallbackId()}`).trim(),
        type,
        city,
        nickname,
        sponsorIds,
      };
    })
    .filter(Boolean);
}

export function normaliseCrossGroupSize(value, maxCrossGroupSize = 10) {
  return dataNormaliseCrossGroupSize(value, maxCrossGroupSize);
}

export function possibleDuplicatePeople(formData, genealogies) {
  const nameKey = normalisedText(formData.name);
  const nicknameKeys = normaliseNicknames(formData.nicknames || [], "").map(normalisedText).filter(Boolean);
  const cityKey = normalisedText(formData.baptismCity);
  const matches = [];
  (Array.isArray(genealogies) ? genealogies : []).forEach((genealogy) => {
    (genealogy.people || []).forEach((person) => {
      const sameName = normalisedText(person.name) === nameKey;
      const sameNickname = nicknameKeys.some((nickname) => (person.nicknames || []).map(normalisedText).includes(nickname));
      const sameCity = cityKey && normalisedText(person.baptismCity) === cityKey;
      if (sameName || (sameNickname && sameCity)) matches.push({ person, genealogy, sameName, sameNickname, sameCity });
    });
  });
  return matches.slice(0, 6);
}

export function displayName(person) {
  return person?.nicknames?.length ? `${person.name} dit ${nicknameText(person)}` : person?.name || "";
}

export function nicknameText(person) {
  return (person?.nicknames || []).join(" / ");
}

export function compactLine(person) {
  const bits = [];
  if (person?.song) bits.push(person.song);
  return bits.join(" - ") || "Informations a completer";
}

export function sameStringArray(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function ceremonyEventKey(event) {
  return JSON.stringify({
    id: event.id,
    type: event.type,
    city: event.city,
    nickname: event.nickname,
    sponsorIds: uniqueIds(event.sponsorIds).sort(),
  });
}

export function uniquePersonIdForPeople(base, people) {
  return uniquePersonIdFrom(base, new Set(people.map((person) => person.id)));
}

export function uniquePersonIdFrom(base, used) {
  const root = base || fallbackId();
  let id = root;
  let index = 2;
  while (used.has(id)) {
    id = `${root}-${index}`;
    index += 1;
  }
  return id;
}

export function createPeopleIndex(people, { cache } = {}) {
  const source = Array.isArray(people) ? people : [];
  const cached = cache?.get(source);
  if (cached) return cached;

  const byId = new Map();
  const childrenBySponsorId = new Map();
  const classicChildrenBySponsorId = new Map();
  const ceremonyChildrenBySponsorId = new Map();
  const crossGroupById = new Map();
  const pushChild = (map, sponsorId, person) => {
    if (!map.has(sponsorId)) map.set(sponsorId, []);
    map.get(sponsorId).push(person);
  };
  source.forEach((person) => {
    if (!person?.id) return;
    byId.set(person.id, person);
    (person.sponsorIds || []).forEach((sponsorId) => {
      pushChild(childrenBySponsorId, sponsorId, person);
      pushChild(classicChildrenBySponsorId, sponsorId, person);
    });
    normaliseCeremonyEvents(person.ceremonyEvents).forEach((ceremony) => {
      ceremony.sponsorIds.forEach((sponsorId) => {
        pushChild(childrenBySponsorId, sponsorId, person);
        pushChild(ceremonyChildrenBySponsorId, sponsorId, person);
      });
    });
    if (person.crossGroupId) {
      if (!crossGroupById.has(person.crossGroupId)) crossGroupById.set(person.crossGroupId, []);
      crossGroupById.get(person.crossGroupId).push(person);
    }
  });

  const sortedByDisplayName = [...source].sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
  const index = { byId, childrenBySponsorId, classicChildrenBySponsorId, ceremonyChildrenBySponsorId, crossGroupById, sortedByDisplayName };
  cache?.set(source, index);
  return index;
}

export function createPeopleSearchRows(
  people,
  { cache, peopleIndexFor, roleLabels, filiereLabel, ceremonyLabel, formatCeremonyDate, ceremonyEventsText, crossGroupSummary } = {}
) {
  const source = Array.isArray(people) ? people : [];
  const cached = cache?.get(source);
  if (cached) return cached;
  const rows = peopleIndexFor(source).sortedByDisplayName.map((person) => ({
    person,
    text: [
      person.name,
      ...(person.nicknames || []),
      ...roleLabels(person.roles),
      filiereLabel(person.filiere),
      person.song,
      person.baptismCity,
      ceremonyLabel(person.ceremonyType),
      formatCeremonyDate(person, true),
      ceremonyEventsText(person),
      crossGroupSummary(person),
    ]
      .join(" ")
      .toLowerCase(),
  }));
  cache?.set(source, rows);
  return rows;
}

export function getPersonFromPeople(people, id, { peopleIndexFor = createPeopleIndex } = {}) {
  return peopleIndexFor(people).byId.get(id) ?? null;
}

export function uniquePeopleById(people) {
  const seen = new Set();
  return people.filter((person) => {
    if (!person || seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
}

export function renderPeopleDetails({
  state,
  els,
  getPerson,
  getHeartSponsors,
  getClassicChildren,
  getCeremonyChildren,
  getAncestorsByDepth,
  getDescendantsByDepth,
  getCrossGroupMembers,
  flattenGroups,
  limitedGroups,
  escapeHtml,
  nicknameText,
  renderRoleBadges,
  filiereLabel,
  formatCeremonyDate,
  ceremonyEventsText,
  crossGroupSummary,
  renderSponsorChips,
  renderChips,
  renderCeremonySponsorChips,
  selectRelatedPerson,
}) {
  const person = getPerson(state.selectedId);
  if (!person) {
    els.detailsPanel.innerHTML = "";
    return;
  }

  const heartSponsors = getHeartSponsors(person);
  const children = getClassicChildren(person.id);
  const ceremonyChildren = getCeremonyChildren(person.id);
  const allAncestors = flattenGroups(limitedGroups(getAncestorsByDepth(person.id), state.ancestorDepth));
  const allDescendants = flattenGroups(limitedGroups(getDescendantsByDepth(person.id), state.descendantDepth));
  const crossMembers = getCrossGroupMembers(person.id).filter((member) => member.id !== person.id);

  els.detailsPanel.innerHTML = `
    <details class="details-menu">
      <summary>
        <span>D&eacute;tails de la fiche</span>
        <small>${allAncestors.length} ascendant(s), ${allDescendants.length} descendant(s)</small>
      </summary>
      <div class="details-body">
        <div class="info-grid">
          <div><strong>Nom</strong>${escapeHtml(person.name)}</div>
          <div><strong>Surnoms</strong>${escapeHtml(nicknameText(person) || "Non renseigne")}</div>
          <div><strong>Pastilles</strong>${renderRoleBadges(person.roles, "Aucune")}</div>
          <div><strong>Filiere</strong>${escapeHtml(filiereLabel(person.filiere))}</div>
          <div><strong>Bapteme</strong>${escapeHtml(formatCeremonyDate(person, true))}</div>
          <div><strong>Ville de bapteme</strong>${escapeHtml(person.baptismCity || "Non renseignee")}</div>
          <div><strong>Adoptions / confirmations</strong>${escapeHtml(ceremonyEventsText(person))}</div>
          <div><strong>Paillarde</strong>${escapeHtml(person.song || "Non renseignee")}</div>
          <div><strong>Bapteme en croisee</strong>${escapeHtml(crossGroupSummary(person))}</div>
          <div><strong>Famille visible</strong>${allAncestors.length} ascendant(s), ${allDescendants.length} descendant(s)</div>
        </div>
        <section>
          <h3>Parrains</h3>
          <div class="chip-list">${renderSponsorChips(person, "Aucun parrain renseigne")}</div>
        </section>
        <section>
          <h3>Parrains de coeur</h3>
          <div class="chip-list">${renderChips(heartSponsors, "Aucun parrain de coeur renseigne")}</div>
        </section>
        <section>
          <h3>Parrains d'adoption / confirmation</h3>
          <div class="chip-list">${renderCeremonySponsorChips(person, "Aucun parrain d'adoption ou de confirmation")}</div>
        </section>
        <section>
          <h3>Fillots</h3>
          <div class="chip-list">${renderChips(children, "Aucun fillot renseigne")}</div>
        </section>
        <section>
          <h3>Fillots d'adoption / confirmation</h3>
          <div class="chip-list">${renderChips(ceremonyChildren, "Aucun fillot d'adoption ou de confirmation")}</div>
        </section>
        <section>
          <h3>Croisee</h3>
          <div class="chip-list">${renderChips(crossMembers, "Aucun bapteme en croisee")}</div>
        </section>
        <section>
          <h3>Ascendance complete</h3>
          <div class="chip-list">${renderChips(allAncestors, "Aucune ascendance renseignee")}</div>
        </section>
        <section>
          <h3>Descendance complete</h3>
          <div class="chip-list">${renderChips(allDescendants, "Aucune descendance renseignee")}</div>
        </section>
      </div>
    </details>
  `;

  els.detailsPanel.querySelectorAll("[data-person-id]").forEach((chip) => {
    chip.addEventListener("click", () => {
      selectRelatedPerson(chip.dataset.personId);
    });
  });
}

export function renderPeopleForm({
  state,
  els,
  editableSelectedPersonEntry,
  formTargetGenealogy,
  relationshipPeopleForGenealogy,
  keepDraftPeopleInFormTarget,
  flattenGroups,
  getDescendantsByDepthFromPeople,
  ensureFormDraft,
  renderGenealogyTargetOptions,
  updatePersonSubmitLabels,
  syncFormSectionsForPerson,
  renderRoleOptions,
  renderFiliereOptions,
  renderSponsorSearchOptions,
  renderSelectedPeople,
  renderPersonPicker,
  renderExtraCeremonyFields,
  renderCrossGroupFields,
}) {
  const selectedEntry = editableSelectedPersonEntry();
  const selected = selectedEntry?.person ?? null;
  if (!selected && !state.genealogies.some((genealogy) => genealogy.id === state.formTargetGenealogyId)) {
    state.formTargetGenealogyId = state.activeGenealogyId;
  }
  ensureFormDraft(selected);
  const formGenealogy = selectedEntry?.genealogy || formTargetGenealogy();
  const targetPeople = formGenealogy.people;
  const relationshipPeople = relationshipPeopleForGenealogy(formGenealogy);
  keepDraftPeopleInFormTarget();
  const blockedSponsorIds = selected
    ? new Set(flattenGroups(getDescendantsByDepthFromPeople(targetPeople, selected.id)).map((person) => person.id))
    : new Set();
  const isFreshRender = els.nameInput.dataset.personId !== state.formPersonId;
  if (isFreshRender) {
    els.nameInput.dataset.personId = state.formPersonId;
    els.formTitle.textContent = selected ? "Fiche faluchard" : "Nouvelle fiche";
    updatePersonSubmitLabels(selected);
    syncFormSectionsForPerson();
    renderGenealogyTargetOptions(selected);
    els.nameInput.value = selected?.name ?? "";
    const nicknames = selected?.nicknames ?? [];
    els.nicknameInput.value = nicknames[0] ?? "";
    els.nickname2Input.value = nicknames[1] ?? "";
    els.nickname3Input.value = nicknames[2] ?? "";
    renderRoleOptions(selected?.roles ?? []);
    els.ceremonyTypeInput.value = selected?.ceremonyType ?? "bapteme";
    els.baptismInput.value = selected?.baptismDate ?? "";
    els.baptismCityInput.value = selected?.baptismCity ?? "";
    els.baptismStatusInput.value = selected?.baptismStatus ?? "unknown";
    els.songInput.value = selected?.song ?? "";
    renderFiliereOptions(selected?.filiere ?? "");
    els.sponsorSearchInput.value = "";
  } else {
    renderGenealogyTargetOptions(selected);
    updatePersonSubmitLabels(selected);
  }
  els.deleteButton.disabled = !selected;
  const sponsorCandidates = relationshipPeople
    .filter((person) => person.id !== state.selectedId)
    .filter((person) => !blockedSponsorIds.has(person.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));

  renderSponsorSearchOptions(sponsorCandidates.filter((person) => !state.draftSponsorIds.includes(person.id)));
  renderSelectedPeople(els.selectedSponsorsList, state.draftSponsorIds, "Aucun parrain choisi", "sponsor", relationshipPeople);

  renderPersonPicker(
    els.heartSponsorPicker,
    sponsorCandidates.filter((person) => !state.draftHeartSponsorIds.includes(person.id)),
    "Choisir un parrain de coeur"
  );
  els.addHeartSponsorButton.disabled = els.heartSponsorPicker.disabled;
  renderSelectedPeople(
    els.selectedHeartSponsorsList,
    state.draftHeartSponsorIds,
    "Aucun parrain de coeur choisi",
    "heart-sponsor",
    relationshipPeople
  );
  renderExtraCeremonyFields(relationshipPeople);
  renderCrossGroupFields(targetPeople);
}

export async function savePeopleForm({
  state,
  els,
  validatePersonForm,
  setFormErrors,
  clearFormErrors,
  editableSelectedPersonEntry,
  formTargetGenealogy,
  genealogyForBaptismCity,
  genealogyInAdminScope,
  showMessage,
  relationshipPeopleForGenealogy,
  validPersonIdsFromPeople,
  readCrossGroupForm,
  normaliseFiliere,
  personFormPermissionMessage,
  applyCrossGroupToPeople,
  syncActiveGenealogy,
  activeGenealogy,
  isAggregateGenealogy,
  withMainGenealogyPeople,
  regionalScopeGenealogies,
  confirmDuplicateCreation,
  todayIso,
  resetFormDraft,
  clearFormDraftLocal,
  persist,
  render,
}) {
  const validation = validatePersonForm();
  if (!validation.valid) {
    setFormErrors(validation.messages, validation.fields);
    validation.fields[0]?.focus();
    return false;
  }
  clearFormErrors();
  const nicknames = normaliseNicknames(
    [els.nicknameInput.value, els.nickname2Input.value, els.nickname3Input.value],
    ""
  );
  const roles = [...els.rolesInput.selectedOptions].map((option) => option.value);
  const selectedEntry = editableSelectedPersonEntry();
  const selected = selectedEntry?.person ?? null;
  const baptismCity = els.baptismCityInput.value.trim();
  let targetGenealogy = selectedEntry?.genealogy || formTargetGenealogy();
  if (!selected && baptismCity) {
    const cityGenealogy = genealogyForBaptismCity(baptismCity);
    if (cityGenealogy) {
      targetGenealogy = cityGenealogy;
      state.formTargetGenealogyId = cityGenealogy.id;
    }
  }
  if (state.adminMode && !genealogyInAdminScope(targetGenealogy)) {
    await showMessage("Action bloquee", "Cet admin regional ne peut pas modifier cette fiche.");
    return false;
  }
  const targetPeople = targetGenealogy.people;
  const relationshipPeople = relationshipPeopleForGenealogy(targetGenealogy);
  const selectedSponsorIds = validPersonIdsFromPeople(state.draftSponsorIds, relationshipPeople);
  const heartSponsorIds = validPersonIdsFromPeople(state.draftHeartSponsorIds, relationshipPeople);
  const crossGroup = readCrossGroupForm(targetPeople);
  if (!crossGroup) return false;

  const ceremonyType = normaliseCeremonyType(els.ceremonyTypeInput.value);

  const formData = {
    name: els.nameInput.value.trim(),
    nickname: nicknames[0] || "",
    nicknames,
    roles: normaliseRoles(roles),
    ceremonyType,
    baptismDate: els.baptismInput.value,
    baptismCity,
    baptismStatus: els.baptismInput.value ? "unknown" : normaliseBaptismStatus(els.baptismStatusInput.value),
    ceremonyEvents: normaliseCeremonyEvents(state.draftCeremonyEvents),
    song: els.songInput.value.trim(),
    filiere: normaliseFiliere(els.filiereInput.value),
    sponsorIds: uniqueIds([...selectedSponsorIds, ...heartSponsorIds]),
    heartSponsorIds,
  };

  if (!formData.name) {
    setFormErrors(["Le nom est obligatoire."], [els.nameInput]);
    return false;
  }

  const permissionMessage = personFormPermissionMessage(selected, formData, crossGroup, targetPeople);
  if (permissionMessage) {
    await showMessage("Modification bloquee", permissionMessage);
    return false;
  }

  let targetId = state.selectedId;
  if (selected) {
    const updatedTargetPeople = applyCrossGroupToPeople(
      targetPeople.map((person) => (person.id === selected.id ? { ...person, ...formData } : person)),
      selected.id,
      crossGroup.size,
      crossGroup.memberIds
    );
    if (targetGenealogy.id === state.activeGenealogyId) {
      state.people = updatedTargetPeople;
      syncActiveGenealogy();
    } else {
      state.genealogies = state.genealogies.map((genealogy) =>
        genealogy.id === targetGenealogy.id ? { ...genealogy, people: updatedTargetPeople } : genealogy
      );
      state.genealogies = withMainGenealogyPeople(state.genealogies);
      if (isAggregateGenealogy(activeGenealogy())) state.people = activeGenealogy().people;
    }
    targetId = selected.id;
  } else {
    const duplicateScope = targetGenealogy ? regionalScopeGenealogies(targetGenealogy) : state.genealogies;
    const duplicates = possibleDuplicatePeople(formData, duplicateScope.length ? duplicateScope : state.genealogies);
    if (duplicates.length) {
      const confirmed = await confirmDuplicateCreation(duplicates);
      if (!confirmed) return false;
    }
    syncActiveGenealogy();
    const freshTargetGenealogy = state.genealogies.find((genealogy) => genealogy.id === targetGenealogy.id) || activeGenealogy();
    const freshTargetPeople = freshTargetGenealogy.people;
    const newPerson = {
      id: uniquePersonIdForPeople(makeId(formData.name), freshTargetPeople),
      createdAt: todayIso(),
      ...formData,
    };
    const updatedTargetPeople = applyCrossGroupToPeople(
      [...freshTargetPeople, newPerson],
      newPerson.id,
      crossGroup.size,
      crossGroup.memberIds
    );
    state.genealogies = state.genealogies.map((genealogy) =>
      genealogy.id === freshTargetGenealogy.id ? { ...genealogy, people: updatedTargetPeople } : genealogy
    );
    state.genealogies = withMainGenealogyPeople(state.genealogies);
    state.activeGenealogyId = freshTargetGenealogy.id;
    state.people = activeGenealogy().people;
    state.selectedId = newPerson.id;
    state.formTargetGenealogyId = state.activeGenealogyId;
    state.publicEditablePersonIds = uniqueIds([...state.publicEditablePersonIds, newPerson.id]);
    targetId = newPerson.id;
  }

  state.prefillSponsorIds = [];
  resetFormDraft();
  clearFormDraftLocal();
  persist();
  render();
  return true;
}
