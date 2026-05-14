import { makeId, uniqueIds } from "../../../modules/data.js";
import { displayName } from "../people/index.js";
import { escapeHtml } from "../../ui/renderHelpers.js";

export function statPersonKey(person) {
  return makeId(person.name || displayName(person));
}

export function compareStatSource(a, b) {
  return (
    a.genealogy.people.length - b.genealogy.people.length ||
    a.genealogy.name.localeCompare(b.genealogy.name, "fr") ||
    displayName(a.person).localeCompare(displayName(b.person), "fr")
  );
}

export function compareStatPeople(a, b) {
  return (
    a.genealogy.name.localeCompare(b.genealogy.name, "fr") ||
    displayName(a.person).localeCompare(displayName(b.person), "fr")
  );
}

export function uniquePeopleByStatIdentity(people) {
  const seen = new Set();
  return people.filter((person) => {
    const key = statPersonKey(person);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function nicknameStats(scores) {
  if (!scores.length) return null;
  const maxLength = Math.max(...scores.map((item) => item.length));
  const winners = scores
    .filter((item) => item.length === maxLength)
    .sort(
      (a, b) =>
        a.nickname.localeCompare(b.nickname, "fr") ||
        a.genealogy.name.localeCompare(b.genealogy.name, "fr") ||
        displayName(a.person).localeCompare(displayName(b.person), "fr")
    );
  return {
    nickname: winners[0].nickname,
    length: maxLength,
    people: uniqueStatPeople(winners.map(({ person, genealogy }) => ({ person, genealogy }))),
  };
}

export function uniqueStatPeople(entries) {
  const seen = new Set();
  return entries.filter(({ person, genealogy }) => {
    const key = `${genealogy.id}:${person.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function timelineTickValues(maxValue) {
  const values = new Set([0, maxValue]);
  for (let index = 1; index < 4; index += 1) {
    values.add(Math.round((maxValue * index) / 4));
  }
  return [...values].sort((a, b) => a - b);
}

export function timelineXAxisLabels(points) {
  const step = Math.max(1, Math.ceil(points.length / 7));
  return points.filter((point, index) => index === 0 || index === points.length - 1 || index % step === 0);
}

export function renderStatsView({
  state,
  els,
  genealogyStats,
  baptismTimelineData,
  statsScopeLabel,
  escapeHtml,
  baptismTimelineViewHtml,
  largestDescendantStatCard,
  topSongStatCard,
  longestNicknameStatCard,
  roleStatsHtml,
  crossGroupsStatCard,
  filiereStatsHtml,
  bindBaptismTimelineControls,
  toggleStatCard,
  selectPersonFromGenealogy,
}) {
  const stats = genealogyStats();
  const timeline = baptismTimelineData();
  els.focusTitle.textContent = "Statistiques";
  els.focusSubtitle.textContent = `${stats.totalPeople} fiche(s) sur ${stats.genealogyCount} arbre(s) - ${statsScopeLabel()}, ${stats.baptizedCount} baptise(s), ${stats.unbaptizedCount} non baptise(s) - evolution ${timeline.periodLabel}`;

  els.graphStage.innerHTML = `
    <div class="stats-page">
      <section class="stats-evolution">
        <div class="stats-section-head">
          <h3>Evolution des baptemes</h3>
          <p>${timeline.entries.length} bapteme(s) renseigne(s), vision ${escapeHtml(timeline.periodLabel)} - ${escapeHtml(timeline.scope)}</p>
        </div>
        ${baptismTimelineViewHtml(timeline)}
      </section>
      <div class="stats-view">
        ${largestDescendantStatCard(stats)}
        ${topSongStatCard(stats)}
        ${longestNicknameStatCard(stats)}
        ${roleStatsHtml(stats)}
        ${crossGroupsStatCard(stats)}
        ${filiereStatsHtml(stats)}
      </div>
    </div>
  `;

  bindBaptismTimelineControls();

  els.graphStage.querySelectorAll("[data-stat-toggle]").forEach((card) => {
    card.addEventListener("pointerdown", (event) => event.stopPropagation());
    card.addEventListener("click", toggleStatCard);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleStatCard(event);
    });
  });

  els.graphStage.querySelectorAll("[data-stat-person-id]").forEach((chip) => {
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      selectPersonFromGenealogy(chip.dataset.statGenealogyId, chip.dataset.statPersonId);
    });
  });
}

export function statToggleAttrs(key, isExpanded) {
  return `data-stat-toggle="${escapeHtml(key)}" role="button" tabindex="0" aria-expanded="${isExpanded ? "true" : "false"}"`;
}

export function renderStatPeopleChips({ entries, emptyText, showGenealogy }) {
  if (entries.length === 0) return `<small>${escapeHtml(emptyText)}</small>`;
  return entries
    .map(({ person, genealogy }) => {
      const note = showGenealogy ? `<span class="chip-note">${escapeHtml(genealogy.name)}</span>` : "";
      return `<button class="chip stat-person-chip" type="button" data-stat-person-id="${escapeHtml(person.id)}" data-stat-genealogy-id="${escapeHtml(genealogy.id)}"><span class="stat-person-name">${escapeHtml(displayName(person))}</span>${note}</button>`;
    })
    .join("");
}

export function renderLargestDescendantStatCard({
  stats,
  expandedStatKey,
  getDescendantsByDepthFromPeople,
  flattenGroups,
  renderStatPeopleChips,
}) {
  const key = "largest-descendant";
  const isExpanded = expandedStatKey === key;
  if (!stats.largestDescendant) {
    return `<section class="stat-card stat-card-button${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
      <h3>Plus grande descendance</h3>
      <strong>Aucune</strong>
      ${isExpanded ? `<div class="stat-list"><small>Aucune personne</small></div>` : ""}
    </section>`;
  }
  const descendants = flattenGroups(
    getDescendantsByDepthFromPeople(stats.largestDescendant.genealogy.people, stats.largestDescendant.person.id)
  ).map((person) => ({ person, genealogy: stats.largestDescendant.genealogy }));
  const list = isExpanded
    ? `<div class="stat-list">${renderStatPeopleChips(descendants, "Aucun descendant")}</div>`
    : "";
  return `<section class="stat-card stat-card-button${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
    <h3>Plus grande descendance</h3>
    <strong>${escapeHtml(displayName(stats.largestDescendant.person))}<span>${stats.largestDescendant.count} descendant(s)</span></strong>
    ${list}
  </section>`;
}

export function renderTopSongStatCard({ stats, expandedStatKey, renderStatPeopleChips }) {
  const key = "top-song";
  const isExpanded = expandedStatKey === key;
  if (!stats.topSong) {
    return `<section class="stat-card stat-card-button${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
      <h3>Paillarde la plus utilisee</h3>
      <strong>Aucune</strong>
      ${isExpanded ? `<div class="stat-list"><small>Aucune personne</small></div>` : ""}
    </section>`;
  }
  const list = isExpanded
    ? `<div class="stat-list">${renderStatPeopleChips(stats.topSong.people, "Aucune personne")}</div>`
    : "";
  return `<section class="stat-card stat-card-button${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
    <h3>Paillarde la plus utilisee</h3>
    <strong>${escapeHtml(stats.topSong.name)}<span>${stats.topSong.count} fois</span></strong>
    ${list}
  </section>`;
}

export function renderLongestNicknameStatCard({ stats, expandedStatKey, renderStatPeopleChips }) {
  const key = "longest-nickname";
  const isExpanded = expandedStatKey === key;
  if (!stats.longestNickname) {
    return `<section class="stat-card stat-card-button${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
      <h3>Surnom le plus long</h3>
      <strong>Aucun</strong>
      ${isExpanded ? `<div class="stat-list"><small>Aucun surnom renseigne</small></div>` : ""}
    </section>`;
  }

  const list = isExpanded
    ? `<div class="stat-list">${renderStatPeopleChips(stats.longestNickname.people, "Aucune personne")}</div>`
    : "";
  return `<section class="stat-card stat-card-button${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
    <h3>Surnom le plus long</h3>
    <strong>${escapeHtml(stats.longestNickname.nickname)}<span>${stats.longestNickname.length} caractere(s)</span></strong>
    ${list}
  </section>`;
}

export function renderCrossGroupsStatCard({ stats, expandedStatKey, renderCrossGroupDetails }) {
  const key = "cross-groups";
  const isExpanded = expandedStatKey === key;
  const list = isExpanded ? `<div class="stat-list">${renderCrossGroupDetails(stats.crossGroups)}</div>` : "";
  return `<section class="stat-card stat-card-button${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
    <h3>Baptemes croises</h3>
    <strong>${stats.crossGroupCount}<span>groupe(s)</span></strong>
    ${list}
  </section>`;
}

export function renderRoleStatCard({ title, role, stats, expandedStatKey, renderStatPeopleChips }) {
  const people = stats.rolePeople[role] || [];
  const key = `role:${role}`;
  const isExpanded = expandedStatKey === key;
  const list = isExpanded
    ? `<div class="stat-list">${renderStatPeopleChips(people, "Aucune personne")}</div>`
    : "";
  return `<section class="stat-card stat-card-button${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
    <h3>${escapeHtml(title)}</h3>
    <strong>${people.length}<span>faluchard(s)</span></strong>
    ${list}
  </section>`;
}

export function renderRoleStatsHtml({ stats, expandedStatKey, renderStatPeopleChips }) {
  return stats.roleOptions
    .map((role) => renderRoleStatCard({ title: role.label, role: role.id, stats, expandedStatKey, renderStatPeopleChips }))
    .join("");
}

export function renderCrossGroupDetails({ groups, renderStatPeopleChips }) {
  if (!groups.length) return `<small>Aucun groupe</small>`;
  return groups
    .map((group, index) => {
      const title = `Groupe ${index + 1} - ${group.genealogy.name}`;
      return `<div class="stat-detail-group">
        <h4>${escapeHtml(title)}</h4>
        <div class="chip-list">${renderStatPeopleChips(group.people, "Aucune personne")}</div>
      </div>`;
    })
    .join("");
}

export function renderFilierePeopleDetails({
  stats,
  filiereStatGroups,
  filiereOptionsForGroup,
  renderStatPeopleChips,
}) {
  const groups = [
    ...filiereStatGroups.map((group) => ({
      label: group.label,
      people: filiereOptionsForGroup(group.id).flatMap((option) => stats.filierePeople[option.id] || []),
    })),
    { label: "Non renseignee", people: stats.unknownFilierePeople },
  ].filter((group) => group.people.length);

  if (!groups.length) return `<small>Aucune personne</small>`;
  return groups
    .map(
      (group) => `<div class="stat-detail-group">
        <h4>${escapeHtml(group.label)} <span>${group.people.length}</span></h4>
        <div class="chip-list">${renderStatPeopleChips(group.people, "Aucune personne")}</div>
      </div>`
    )
    .join("");
}

export function renderFiliereStatsGroupRow({ group, stats, filiereOptionsForGroup, filiereSwatchHtml }) {
  const options = filiereOptionsForGroup(group.id);
  const count = options.reduce((total, option) => total + (stats.filiereCounts[option.id] || 0), 0);
  const circular = uniqueIds(options.map((option) => option.circular)).join(" / ");
  const subRows =
    options.length > 1
      ? `<div class="stat-filiere-subrows">${options
          .map(
            (option) =>
              `<span>${filiereSwatchHtml(option.id)}${escapeHtml(option.label)}</span><strong>${stats.filiereCounts[option.id] || 0}</strong>`
          )
          .join("")}</div>`
      : "";
  const swatch = options.length === 1 ? filiereSwatchHtml(options[0].id) : `<i class="filiere-swatch multi"></i>`;
  return `<li class="stat-filiere-row">
    <span class="stat-filiere-main">${swatch}<span>${escapeHtml(group.label)}${circular ? `<small>${escapeHtml(circular)}</small>` : ""}</span></span>
    <strong>${count}</strong>
    ${subRows}
  </li>`;
}

export function renderFiliereStatsHtml({
  stats,
  expandedStatKey,
  filiereStatGroups,
  filiereOptionsForGroup,
  filiereSwatchHtml,
  renderFilierePeopleDetails,
}) {
  const rows = filiereStatGroups
    .map((group) => renderFiliereStatsGroupRow({ group, stats, filiereOptionsForGroup, filiereSwatchHtml }))
    .join("");
  const key = "filieres";
  const isExpanded = expandedStatKey === key;
  const list = isExpanded ? `<div class="stat-list">${renderFilierePeopleDetails(stats)}</div>` : "";
  return `<section class="stat-card stat-card-button stat-wide${isExpanded ? " is-expanded" : ""}" ${statToggleAttrs(key, isExpanded)}>
    <h3>Faluchards par filiere</h3>
    <ul class="stat-breakdown filiere-stat-breakdown">${rows}<li class="stat-filiere-row"><span>Non renseignee</span><strong>${stats.unknownFiliereCount}</strong></li></ul>
    ${list}
  </section>`;
}
