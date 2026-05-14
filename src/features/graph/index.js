import { readDepth } from "../../../modules/data.js";
import { displayName } from "../people/index.js";
import { escapeHtml } from "../../ui/renderHelpers.js";

export function walkByDepth(startPeople, nextPeople, startId, maxDepth = 20) {
  const groups = [];
  const visited = new Set([startId]);
  let current = uniquePeopleById(startPeople.flatMap(nextPeople));

  while (current.length && groups.length < maxDepth) {
    const fresh = uniquePeopleById(current.filter((person) => !visited.has(person.id)));
    if (!fresh.length) break;
    fresh.forEach((person) => visited.add(person.id));
    groups.push(fresh);
    current = uniquePeopleById(fresh.flatMap(nextPeople));
  }

  return groups;
}

export function limitedGroups(groups, depth) {
  return groups.slice(0, readDepth(depth));
}

export function flattenGroups(groups) {
  return uniquePeopleById(groups.flat());
}

export function buildGraphRings({ person, ancestorGroups, descendantGroups }) {
  const rings = [];
  const used = new Set();
  ancestorGroups.forEach((group) => pushRing(rings, used, group.people));
  pushRing(rings, used, [person]);
  descendantGroups.forEach((group) => pushRing(rings, used, group.people));
  return rings;
}

export function renderGraphView({
  state,
  els,
  documentRef,
  promoteFamilyGraphToRegionalScope,
  getPerson,
  upcomingEventsForActiveRegion,
  viewModeButtons,
  renderUpcomingBaptisms,
  renderOverview,
  renderStats,
  renderNewcomers,
  lineageSponsorLinks,
  getChildren,
  getAncestorsByDepth,
  getDescendantsByDepth,
  getCrossGroupMembers,
  displayName,
  renderNetwork,
  renderTree,
}) {
  if (state.mode === "baptismTimeline") state.mode = "stats";
  documentRef.body.classList.toggle("show-graph-zoom", state.mode === "tree" || state.mode === "network");
  promoteFamilyGraphToRegionalScope();
  const person = getPerson(state.selectedId);
  const upcomingEvents = upcomingEventsForActiveRegion();
  els.upcomingModeButton.textContent = upcomingEvents.length
    ? `Event a venir (${upcomingEvents.length})`
    : "Event a venir";
  viewModeButtons.forEach(({ button, mode }) => button.classList.toggle("is-active", state.mode === mode));

  if (state.mode === "upcoming") {
    renderUpcomingBaptisms();
    return;
  }

  if (state.mode === "overview") {
    renderOverview();
    return;
  }

  if (state.mode === "stats") {
    renderStats();
    return;
  }

  if (state.mode === "newcomers") {
    renderNewcomers();
    return;
  }

  if (!person) {
    els.focusTitle.textContent = "Aucun faluchard selectionne";
    els.focusSubtitle.textContent = "Ajoute une personne pour commencer.";
    els.graphStage.innerHTML = `<div class="empty-state">La genealogie apparaitra ici.</div>`;
    return;
  }

  const sponsors = lineageSponsorLinks(person);
  const children = getChildren(person.id);
  const allAncestors = flattenGroups(limitedGroups(getAncestorsByDepth(person.id), state.ancestorDepth));
  const allDescendants = flattenGroups(limitedGroups(getDescendantsByDepth(person.id), state.descendantDepth));
  const crossMembers = getCrossGroupMembers(person.id);
  els.focusTitle.textContent = displayName(person);
  els.focusSubtitle.textContent = `${sponsors.length} parrain(s), ${children.length} fillot(s) - ${allAncestors.length} ascendant(s), ${allDescendants.length} descendant(s) au total${crossMembers.length ? ` - croisee a ${crossMembers.length}` : ""}`;

  if (state.mode === "network") {
    renderNetwork(person);
  } else {
    renderTree(person);
  }
}

export function renderTreeView({
  els,
  person,
  ancestorDepth,
  descendantDepth,
  getAncestorsByDepth,
  getDescendantsByDepth,
  lineageSponsorLinks,
  childRelationshipLinks,
  generation,
  relationshipGeneration,
  ancestorLabel,
  descendantLabel,
  focusGroup,
  focusGroupLabel,
  connector,
  applyGraphZoom,
  documentRef = globalThis.document,
}) {
  els.graphStage.innerHTML = "";
  const tree = documentRef.createElement("div");
  tree.className = "tree-view graph-canvas";
  const rows = [];
  const ancestorGroups = limitedGroups(getAncestorsByDepth(person.id), ancestorDepth);
  const descendantGroups = limitedGroups(getDescendantsByDepth(person.id), descendantDepth);
  const directSponsorLinks = lineageSponsorLinks(person);
  const directChildLinks = childRelationshipLinks(person.id);

  if (directSponsorLinks.length) {
    ancestorGroups.slice(1)
      .map((people, index) => ({ people, depth: index + 2 }))
      .reverse()
      .forEach((group) => rows.push(generation(group.people, "", false, ancestorLabel(group.depth))));
    rows.push(relationshipGeneration(directSponsorLinks, "Aucun parrain direct", "Parrains"));
  } else if (ancestorGroups.length) {
    ancestorGroups
      .map((people, index) => ({ people, depth: index + 1 }))
      .reverse()
      .forEach((group) => rows.push(generation(group.people, "", false, ancestorLabel(group.depth))));
  } else {
    rows.push(generation([], "Aucun parrain direct", false, "Parrains"));
  }

  rows.push(generation(focusGroup(person), "", true, focusGroupLabel(person)));

  if (directChildLinks.length) {
    rows.push(relationshipGeneration(directChildLinks, "Aucun fillot direct", "Fillots"));
    descendantGroups.slice(1).forEach((people, index) => {
      rows.push(generation(people, "", false, descendantLabel(index + 2)));
    });
  } else if (descendantGroups.length) {
    descendantGroups.forEach((people, index) => {
      rows.push(generation(people, "", false, descendantLabel(index + 1)));
    });
  } else {
    rows.push(generation([], "Aucun fillot direct", false, "Fillots"));
  }

  rows.forEach((row, index) => {
    tree.append(row);
    if (index < rows.length - 1) tree.append(connector());
  });
  els.graphStage.append(tree);
  applyGraphZoom();
}

export function renderNetworkView({
  state,
  els,
  person,
  relationshipLegend,
  networkLayout,
  graphPerson,
  lineageSponsorLinks,
  getCrossGroupMembers,
  edge,
  nodeCard,
  applyGraphZoom,
  centerMobileNetworkOnPerson,
  documentRef = globalThis.document,
}) {
  els.graphStage.innerHTML = "";
  els.graphStage.append(relationshipLegend());
  const network = documentRef.createElement("div");
  network.className = "network-view graph-canvas";
  const layout = networkLayout(person);
  const positions = layout.positions;
  network.style.minWidth = `${layout.width}px`;
  network.style.minHeight = `${layout.height}px`;

  positions.forEach((position, id) => {
    const current = graphPerson(id);
    if (!current) return;
    lineageSponsorLinks(current).forEach((link) => {
      if (positions.has(link.id)) network.append(edge(positions.get(link.id), position, link.kind));
    });
  });

  state.people.forEach((current) => {
    if (!current.crossGroupId || !positions.has(current.id)) return;
    getCrossGroupMembers(current.id).forEach((member) => {
      if (member.id <= current.id || !positions.has(member.id)) return;
      network.append(edge(positions.get(current.id), positions.get(member.id), "cross"));
    });
  });

  positions.forEach((position, id) => {
    const current = graphPerson(id);
    if (!current) return;
    const card = nodeCard(current, id === person.id);
    card.classList.add("network-node");
    card.style.left = `${position.x - 77}px`;
    card.style.top = `${position.y}px`;
    network.append(card);
  });

  els.graphStage.append(network);
  applyGraphZoom();
  centerMobileNetworkOnPerson(person.id);
}

export function renderOverviewView({
  state,
  els,
  sortedEntriesByFiliere,
  deduplicatedStatEntries,
  overviewGroupsByFiliere,
  nodeCard,
  escapeHtml,
  applyGraphZoom,
  documentRef = globalThis.document,
}) {
  const entries = sortedEntriesByFiliere(deduplicatedStatEntries());
  els.focusTitle.textContent = "Vue d'ensemble";
  els.focusSubtitle.textContent = `${entries.length} faluchard(s) sur ${state.genealogies.length} arbre(s), tries par filiere`;
  els.graphStage.innerHTML = "";

  if (!entries.length) {
    els.graphStage.innerHTML = `<div class="empty-state">Aucune genealogie a afficher.</div>`;
    return;
  }

  const overview = documentRef.createElement("div");
  overview.className = "overview-grid graph-canvas";
  overviewGroupsByFiliere(entries).forEach((group) => {
    const section = documentRef.createElement("section");
    section.className = "overview-tree";
    section.innerHTML = `<h3>${escapeHtml(group.label)} <span>${group.entries.length}</span></h3>`;
    const list = documentRef.createElement("div");
    list.className = "overview-list";
    group.entries.forEach(({ person, genealogy }) => {
      const isFocused = genealogy.id === state.activeGenealogyId && person.id === state.selectedId;
      list.append(nodeCard(person, isFocused, genealogy.id, genealogy.name));
    });
    section.append(list);
    overview.append(section);
  });

  els.graphStage.append(overview);
  applyGraphZoom();
}

export function renderNewcomersView({
  state,
  els,
  latestNewcomers,
  personCardHtml,
  render,
}) {
  const people = latestNewcomers();
  els.focusTitle.textContent = "Nouveaux venus";
  els.focusSubtitle.textContent = `${people.length} dernier(s) faluchard(s) baptise(s), du plus ancien au plus recent`;

  if (!people.length) {
    els.graphStage.innerHTML = `<div class="empty-state">Aucun bapteme renseigne pour le moment.</div>`;
    return;
  }

  els.graphStage.innerHTML = `<div class="newcomers-grid">${people.map(personCardHtml).join("")}</div>`;
  els.graphStage.querySelectorAll("[data-person-id]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedId = card.dataset.personId;
      state.mode = "tree";
      render();
    });
  });
}

export function createGenerationBand({
  people,
  emptyText,
  focus = false,
  label = "",
  nodeCard,
  documentRef = globalThis.document,
}) {
  const band = documentRef.createElement("div");
  band.className = "generation-band";

  if (label) {
    const labelEl = documentRef.createElement("p");
    labelEl.className = "level-label";
    labelEl.textContent = label;
    band.append(labelEl);
  }

  const row = documentRef.createElement("div");
  row.className = "generation";

  if (people.length === 0) {
    const empty = documentRef.createElement("div");
    empty.className = "node-card";
    empty.innerHTML = `<strong>${escapeHtml(emptyText)}</strong><span>Complete la fiche pour enrichir l'arbre</span>`;
    row.append(empty);
    band.append(row);
    return band;
  }

  people.forEach((person) => row.append(nodeCard(person, focus)));
  band.append(row);
  return band;
}

export function createRelationshipGenerationBand({
  links,
  emptyText,
  label = "",
  nodeCard,
  documentRef = globalThis.document,
}) {
  const band = documentRef.createElement("div");
  band.className = "generation-band";

  if (label) {
    const labelEl = documentRef.createElement("p");
    labelEl.className = "level-label";
    labelEl.textContent = label;
    band.append(labelEl);
  }

  const row = documentRef.createElement("div");
  row.className = "generation";
  const validLinks = links.filter((link) => link?.person);

  if (validLinks.length === 0) {
    const empty = documentRef.createElement("div");
    empty.className = "node-card";
    empty.innerHTML = `<strong>${escapeHtml(emptyText)}</strong><span>Complete la fiche pour enrichir l'arbre</span>`;
    row.append(empty);
    band.append(row);
    return band;
  }

  validLinks.forEach((link) => row.append(nodeCard(link.person, false, "", link.label)));
  band.append(row);
  return band;
}

export function createConnector({ documentRef = globalThis.document } = {}) {
  const line = documentRef.createElement("div");
  line.className = "connector";
  return line;
}

export function createRelationshipLegend({ documentRef = globalThis.document } = {}) {
  const legend = documentRef.createElement("div");
  legend.className = "graph-legend";
  legend.innerHTML = `
    <span><i class="legend-line"></i>Parrain</span>
    <span><i class="legend-line heart"></i>Parrain de coeur</span>
    <span><i class="legend-line adoption"></i>Parrain d'adoption</span>
    <span><i class="legend-line confirmation"></i>Parrain de confirmation</span>
    <span><i class="legend-line cross"></i>Bapteme croise</span>
  `;
  return legend;
}

export function graphNodeCardClass(person, focus = false) {
  return `node-card filiere-${person.filiere || "none"}${focus ? " focus" : ""}`;
}

export function graphCrossGroupInfoHtml({ person, crossGroupDetail }) {
  const detail = crossGroupDetail(person);
  return detail ? `<span>${escapeHtml(detail)}</span>` : "";
}

export function graphNodeInfoHtml({
  person,
  contextLabel = "",
  renderRoleBadges,
  filiereLabel,
  compactLine,
  crossGroupDetail,
  formatCeremonyDate,
  ceremonyEventsText,
}) {
  const ceremonyInfo = ceremonyEventsText(person);
  return `<span class="node-info">
    ${contextLabel ? `<span>${escapeHtml(contextLabel)}</span>` : ""}
    ${renderRoleBadges(person.roles)}
    <span>${escapeHtml(filiereLabel(person.filiere))}</span>
    <span>${escapeHtml(compactLine(person))}</span>
    ${graphCrossGroupInfoHtml({ person, crossGroupDetail })}
    <span>${escapeHtml(formatCeremonyDate(person, true))}</span>
    ${ceremonyInfo !== "Aucune" ? `<span>${escapeHtml(ceremonyInfo)}</span>` : ""}
  </span>`;
}

export function createGraphNodeCard({
  person,
  focus = false,
  genealogyId = "",
  contextLabel = "",
  resolveGenealogyId,
  filiereStrip,
  nodeInfoHtml,
  onSelectDifferentGenealogy,
  onSelectSameGenealogy,
  documentRef = globalThis.document,
}) {
  const cardGenealogyId = genealogyId || resolveGenealogyId(person.id);
  const button = documentRef.createElement("button");
  button.className = graphNodeCardClass(person, focus);
  button.type = "button";
  button.dataset.personId = person.id;
  button.dataset.genealogyId = cardGenealogyId;
  const strip = filiereStrip(person.filiere);
  if (strip) button.style.setProperty("--filiere-strip", strip);
  button.innerHTML = `
    <strong>${escapeHtml(displayName(person))}</strong>
    ${nodeInfoHtml(person, contextLabel)}
  `;
  button.addEventListener("click", () => {
    if (onSelectDifferentGenealogy(cardGenealogyId, person.id)) return;
    onSelectSameGenealogy(cardGenealogyId, person.id);
  });
  return button;
}

export function graphPersonCardHtml({
  person,
  filiereStyleAttr,
  nodeInfoHtml,
}) {
  return `<button class="${graphNodeCardClass(person)} newcomer-card" type="button" data-person-id="${escapeHtml(person.id)}" ${filiereStyleAttr(person.filiere)}>
    <strong>${escapeHtml(displayName(person))}</strong>
    ${nodeInfoHtml(person)}
  </button>`;
}

function pushRing(rings, used, people) {
  const fresh = people.filter((person) => {
    if (used.has(person.id)) return false;
    used.add(person.id);
    return true;
  });
  if (fresh.length) rings.push({ people: fresh });
}

function uniquePeopleById(people) {
  const seen = new Set();
  return people.filter((person) => {
    if (!person || seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
}
