import assert from "node:assert/strict";

import {
  activePeopleFromGenealogyState,
  createAppState,
  createGenealogyIndex,
  loadStoredGenealogyState,
  loadStoredJson,
  saveStoredGenealogyState,
  saveStoredJson,
  storageKeys,
} from "../src/state.js";
import {
  flattenGroups,
  graphNodeCardClass,
  graphPersonCardHtml,
  limitedGroups,
  renderGraphView,
  renderNewcomersView,
  renderOverviewView,
  renderTreeView,
  walkByDepth,
} from "../src/features/graph/index.js";
import { setViewModeAction, updateGraphZoomAction } from "../src/features/graph/actions.js";
import {
  createPeopleIndex,
  createPeopleSearchRows,
  displayName,
  nicknameText,
  normalisePeople,
  possibleDuplicatePeople,
  renderPeopleDetails,
  renderPeopleForm,
  uniquePersonIdFrom,
} from "../src/features/people/index.js";
import {
  addDraftPersonAction,
  removeDraftPersonAction,
  sanitiseAdminSelectionAction,
  setAdminPersonSelectedAction,
  toggleAdminSelectionAction,
} from "../src/features/people/actions.js";
import { applyAdminSessionAction } from "../src/features/admin/actions.js";
import {
  nicknameStats,
  renderStatPeopleChips,
  renderTopSongStatCard,
  renderStatsView,
  timelineTickValues,
  timelineXAxisLabels,
  uniquePeopleByStatIdentity,
} from "../src/features/stats/index.js";
import { normaliseUpcomingBaptisms, renderUpcomingSponsorSelectionHtml } from "../src/features/upcoming/index.js";
import { addUpcomingSponsorAction, captureUpcomingAnnouncementDraftAction } from "../src/features/upcoming/actions.js";
import { escapeHtml, joinHtml } from "../src/ui/renderHelpers.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const storage = memoryStorage();
const normaliseGenealogyState = (value) => ({
  activeGenealogyId: value.activeGenealogyId || "main",
  genealogies: value.genealogies || [{ id: "main", people: [] }],
  upcomingBaptisms: value.upcomingBaptisms || [],
});

saveStoredGenealogyState({ activeGenealogyId: "main", genealogies: [{ id: "main", people: [] }], upcomingBaptisms: [] }, { storage });
assert.equal(loadStoredGenealogyState({ storage, normaliseGenealogyState }).activeGenealogyId, "main");

saveStoredJson([{ id: "d1" }], { storage, key: storageKeys.doleances });
assert.deepEqual(loadStoredJson({ storage, key: storageKeys.doleances, fallback: [] }), [{ id: "d1" }]);

const appState = createAppState({
  initialGenealogyState: normaliseGenealogyState({ activeGenealogyId: "main", genealogies: [{ id: "main", people: [{ id: "p1" }] }] }),
  activePeople: (state) => state.genealogies[0].people,
  recentPersonIds: [{ genealogyId: "main", personId: "p1" }],
});
assert.equal(appState.people[0].id, "p1");
assert.equal(appState.mode, "tree");

const genealogyState = {
  activeGenealogyId: "family",
  genealogies: [
    { id: "main", name: "Nationale", type: "main", people: [{ id: "root" }] },
    { id: "region", name: "Alsace", type: "regional", parentId: "main", people: [] },
    { id: "family", name: "Famille", type: "family", parentId: "region", people: [{ id: "child" }] },
  ],
};
const genealogyIndex = createGenealogyIndex(genealogyState.genealogies, {
  isMainGenealogy: (genealogy) => genealogy.type === "main",
  isRegionalGenealogy: (genealogy) => genealogy.type === "regional",
  isFamilyGenealogy: (genealogy) => genealogy.type === "family",
});
assert.equal(genealogyIndex.main.id, "main");
assert.deepEqual(genealogyIndex.regions.map((genealogy) => genealogy.id), ["region"]);
assert.deepEqual(activePeopleFromGenealogyState(genealogyState, {
  isMainGenealogy: (genealogy) => genealogy.type === "main",
  isRegionalGenealogy: (genealogy) => genealogy.type === "regional",
  isFamilyGenealogy: (genealogy) => genealogy.type === "family",
}).map((person) => person.id), ["child"]);

const actionState = {
  mode: "tree",
  graphZoom: 1,
  draftSponsorIds: [],
  draftCrossMemberIds: ["a"],
  draftCrossGroupSize: 2,
  adminSelectedPersonIds: ["a", "missing"],
  upcomingSponsorIds: [],
  upcomingAnnouncementDraft: {},
};
assert.equal(setViewModeAction(actionState, "stats"), "stats");
assert.equal(updateGraphZoomAction(actionState, 0.1), 1.1);
assert.deepEqual(addDraftPersonAction(actionState, "draftSponsorIds", "a"), ["a"]);
assert.deepEqual(removeDraftPersonAction(actionState, "draftCrossMemberIds", "a"), []);
assert.equal(actionState.draftCrossGroupSize, 0);
assert.deepEqual(sanitiseAdminSelectionAction(actionState, [{ id: "a" }]), ["a"]);
assert.deepEqual(toggleAdminSelectionAction(actionState, [{ id: "a" }, { id: "b" }], true), ["a", "b"]);
assert.deepEqual(setAdminPersonSelectedAction(actionState, "b", false), ["a"]);
assert.deepEqual(addUpcomingSponsorAction(actionState, "p1"), ["p1"]);
assert.equal(
  applyAdminSessionAction(actionState, { level: "regional", regionId: "region" }, (session) => session).level,
  "regional"
);

const people = normalisePeople(
  [
    { id: "a", name: "Alice", nickname: "Ali", sponsorIds: ["b"], filiere: "med" },
    { id: "b", name: "Bob", sponsorIds: ["a"], heartSponsorIds: ["a"] },
  ],
  { normaliseFiliere: (value) => (value === "med" ? "medecine" : ""), maxCrossGroupSize: 10 }
);
assert.equal(displayName(people[0]), "Alice dit Ali");
assert.equal(people[0].filiere, "medecine");
assert.deepEqual(people[1].sponsorIds, ["a"]);
assert.equal(uniquePersonIdFrom("a", new Set(["a", "a-2"])), "a-3");

const peopleIndex = createPeopleIndex(people);
assert.equal(peopleIndex.byId.get("a").name, "Alice");
assert.deepEqual(peopleIndex.childrenBySponsorId.get("a").map((person) => person.id), ["b"]);
assert.equal(
  createPeopleSearchRows(people, {
    peopleIndexFor: createPeopleIndex,
    roleLabels: () => [],
    filiereLabel: (value) => value,
    ceremonyLabel: () => "",
    formatCeremonyDate: () => "",
    ceremonyEventsText: () => "",
    crossGroupSummary: () => "",
  })[0].text.includes("alice"),
  true
);

class FakeFormData {
  constructor(form) {
    this.values = form.values || {};
  }
  get(key) {
    return this.values[key] || "";
  }
}
const upcomingActionState = { upcomingAnnouncementDraft: {}, upcomingAnnouncementKind: "" };
captureUpcomingAnnouncementDraftAction(
  upcomingActionState,
  {
    dataset: { upcomingKind: "cooptage" },
    values: { eventType: "cooptage", baptizedNames: "A", dateTime: "2026-05-14T18:00", place: "Lieu", message: "Message" },
    querySelector: (selector) => ({ value: selector.includes("sponsor") ? "Alice" : "Bob" }),
  },
  FakeFormData
);
assert.equal(upcomingActionState.upcomingAnnouncementDraft.kind, "cooptage");
assert.equal(upcomingActionState.upcomingAnnouncementDraft.sponsorSearch, "Alice");

const duplicates = possibleDuplicatePeople(
  { name: "Alice", nicknames: ["Ali"], baptismCity: "" },
  [{ id: "main", name: "Main", people }]
);
assert.equal(duplicates.length, 1);

const nextById = new Map([
  ["a", ["b", "c"]],
  ["b", ["d"]],
  ["c", []],
  ["d", []],
]);
const peopleById = new Map(["a", "b", "c", "d"].map((id) => [id, { id }]));
const groups = walkByDepth([peopleById.get("a")], (person) => nextById.get(person.id).map((id) => peopleById.get(id)), "a");
assert.deepEqual(groups.map((group) => group.map((person) => person.id)), [["b", "c"], ["d"]]);
assert.deepEqual(flattenGroups(groups).map((person) => person.id), ["b", "c", "d"]);
assert.equal(limitedGroups(groups, 1).length, 1);

const graphDocument = {
  body: {
    classList: {
      calls: [],
      toggle(name, value) {
        this.calls.push([name, value]);
      },
    },
  },
};
const graphEls = {
  upcomingModeButton: { textContent: "" },
  focusTitle: { textContent: "" },
  focusSubtitle: { textContent: "" },
  graphStage: { innerHTML: "" },
};
renderGraphView({
  state: { mode: "tree", selectedId: "missing", ancestorDepth: 20, descendantDepth: 20 },
  els: graphEls,
  documentRef: graphDocument,
  promoteFamilyGraphToRegionalScope: () => {},
  getPerson: () => null,
  upcomingEventsForActiveRegion: () => [{ id: "event" }],
  viewModeButtons: [{ button: { classList: { toggle: () => {} } }, mode: "tree" }],
  renderUpcomingBaptisms: () => assert.fail("unexpected upcoming render"),
  renderOverview: () => assert.fail("unexpected overview render"),
  renderStats: () => assert.fail("unexpected stats render"),
  renderNewcomers: () => assert.fail("unexpected newcomers render"),
  lineageSponsorLinks: () => [],
  getChildren: () => [],
  getAncestorsByDepth: () => [],
  getDescendantsByDepth: () => [],
  getCrossGroupMembers: () => [],
  displayName,
  renderNetwork: () => assert.fail("unexpected network render"),
  renderTree: () => assert.fail("unexpected tree render"),
});
assert.equal(graphEls.upcomingModeButton.textContent, "Event a venir (1)");
assert.match(graphEls.graphStage.innerHTML, /genealogie apparaitra/);

const formCalls = [];
const formEls = {
  nameInput: { dataset: { personId: "" }, value: "" },
  formTitle: { textContent: "" },
  nicknameInput: { value: "" },
  nickname2Input: { value: "" },
  nickname3Input: { value: "" },
  ceremonyTypeInput: { value: "" },
  baptismInput: { value: "" },
  baptismCityInput: { value: "" },
  baptismStatusInput: { value: "" },
  songInput: { value: "" },
  sponsorSearchInput: { value: "" },
  deleteButton: { disabled: true },
  heartSponsorPicker: { disabled: false },
  addHeartSponsorButton: { disabled: true },
  selectedSponsorsList: {},
  selectedHeartSponsorsList: {},
};
renderPeopleForm({
  state: {
    genealogies: [{ id: "main" }],
    formTargetGenealogyId: "main",
    activeGenealogyId: "main",
    formPersonId: "a",
    selectedId: "a",
    draftSponsorIds: [],
    draftHeartSponsorIds: [],
  },
  els: formEls,
  editableSelectedPersonEntry: () => ({ person: people[0], genealogy: { id: "main", people } }),
  formTargetGenealogy: () => ({ id: "main", people }),
  relationshipPeopleForGenealogy: () => people,
  keepDraftPeopleInFormTarget: () => formCalls.push("keepDraft"),
  flattenGroups: () => [],
  getDescendantsByDepthFromPeople: () => [],
  ensureFormDraft: () => formCalls.push("ensureDraft"),
  renderGenealogyTargetOptions: () => formCalls.push("targetOptions"),
  updatePersonSubmitLabels: () => formCalls.push("submitLabels"),
  syncFormSectionsForPerson: () => formCalls.push("sections"),
  renderRoleOptions: () => formCalls.push("roles"),
  renderFiliereOptions: () => formCalls.push("filieres"),
  renderSponsorSearchOptions: () => formCalls.push("sponsorSearch"),
  renderSelectedPeople: () => formCalls.push("selectedPeople"),
  renderPersonPicker: (select) => {
    select.disabled = false;
    formCalls.push("personPicker");
  },
  renderExtraCeremonyFields: () => formCalls.push("extraCeremony"),
  renderCrossGroupFields: () => formCalls.push("crossGroup"),
});
assert.equal(formEls.formTitle.textContent, "Fiche faluchard");
assert.equal(formEls.nameInput.value, "Alice");
assert.equal(formEls.deleteButton.disabled, false);
assert.ok(formCalls.includes("crossGroup"));
assert.equal(graphNodeCardClass({ filiere: "medecine" }, true), "node-card filiere-medecine focus");
assert.match(
  graphPersonCardHtml({
    person: people[0],
    filiereStyleAttr: () => "",
    nodeInfoHtml: () => "<span>Infos</span>",
  }),
  /Alice dit Ali/
);

function elementStub(tagName = "div") {
  return {
    tagName,
    className: "",
    innerHTML: "",
    style: {},
    dataset: {},
    children: [],
    classList: { add() {} },
    append(...items) {
      this.children.push(...items);
    },
  };
}

let selectedDetailPerson = "";
const detailChip = {
  dataset: { personId: "b" },
  addEventListener(_event, handler) {
    this.handler = handler;
  },
};
const detailPanel = {
  innerHTML: "",
  querySelectorAll() {
    return [detailChip];
  },
};
renderPeopleDetails({
  state: { selectedId: "a", ancestorDepth: 20, descendantDepth: 20 },
  els: { detailsPanel: detailPanel },
  getPerson: (id) => people.find((person) => person.id === id),
  getHeartSponsors: () => [],
  getClassicChildren: () => [people[1]],
  getCeremonyChildren: () => [],
  getAncestorsByDepth: () => [[people[1]]],
  getDescendantsByDepth: () => [],
  getCrossGroupMembers: () => [],
  flattenGroups,
  limitedGroups,
  escapeHtml,
  nicknameText,
  renderRoleBadges: () => "Aucune",
  filiereLabel: (value) => value,
  formatCeremonyDate: () => "",
  ceremonyEventsText: () => "",
  crossGroupSummary: () => "",
  renderSponsorChips: () => "",
  renderChips: (items) => items.map((person) => `<button data-person-id="${person.id}">${person.name}</button>`).join(""),
  renderCeremonySponsorChips: () => "",
  selectRelatedPerson: (id) => {
    selectedDetailPerson = id;
  },
});
assert.match(detailPanel.innerHTML, /Details de la fiche|D&eacute;tails de la fiche/);
detailChip.handler();
assert.equal(selectedDetailPerson, "b");

const docStub = { createElement: elementStub };
const treeStage = elementStub("stage");
renderTreeView({
  els: { graphStage: treeStage },
  person: { id: "a" },
  ancestorDepth: 20,
  descendantDepth: 20,
  getAncestorsByDepth: () => [[{ id: "parent" }]],
  getDescendantsByDepth: () => [],
  lineageSponsorLinks: () => [],
  childRelationshipLinks: () => [],
  generation: (items) => elementStub(`generation-${items.length}`),
  relationshipGeneration: () => elementStub("relationship"),
  ancestorLabel: () => "Ancetre",
  descendantLabel: () => "Descendant",
  focusGroup: (person) => [person],
  focusGroupLabel: () => "Focus",
  connector: () => elementStub("connector"),
  applyGraphZoom: () => {},
  documentRef: docStub,
});
assert.equal(treeStage.children.length, 1);

const overviewStage = elementStub("stage");
renderOverviewView({
  state: { genealogies: [{ id: "main" }], activeGenealogyId: "main", selectedId: "a" },
  els: { focusTitle: {}, focusSubtitle: {}, graphStage: overviewStage },
  sortedEntriesByFiliere: (entries) => entries,
  deduplicatedStatEntries: () => [{ person: people[0], genealogy: { id: "main", name: "Main" } }],
  overviewGroupsByFiliere: (entries) => [{ label: "Medecine", entries }],
  nodeCard: () => elementStub("card"),
  escapeHtml,
  applyGraphZoom: () => {},
  documentRef: docStub,
});
assert.equal(overviewStage.children.length, 1);

const newcomersChip = {
  dataset: { personId: "a" },
  addEventListener(_event, handler) {
    this.handler = handler;
  },
};
const newcomersStage = {
  innerHTML: "",
  querySelectorAll() {
    return [newcomersChip];
  },
};
const newcomersState = { selectedId: "", mode: "newcomers" };
let newcomersRendered = false;
renderNewcomersView({
  state: newcomersState,
  els: { focusTitle: {}, focusSubtitle: {}, graphStage: newcomersStage },
  latestNewcomers: () => [people[0]],
  personCardHtml: () => `<button data-person-id="a"></button>`,
  render: () => {
    newcomersRendered = true;
  },
});
newcomersChip.handler();
assert.equal(newcomersState.selectedId, "a");
assert.equal(newcomersState.mode, "tree");
assert.equal(newcomersRendered, true);

const statsCards = [
  {
    dataset: { statToggle: "x" },
    addEventListener(event, handler) {
      this[event] = handler;
    },
  },
];
const statChips = [
  {
    dataset: { statGenealogyId: "main", statPersonId: "a" },
    addEventListener(event, handler) {
      this[event] = handler;
    },
  },
];
const statsStage = {
  innerHTML: "",
  querySelectorAll(selector) {
    if (selector === "[data-stat-toggle]") return statsCards;
    if (selector === "[data-stat-person-id]") return statChips;
    return [];
  },
};
let selectedFromStats = null;
renderStatsView({
  state: {},
  els: { focusTitle: {}, focusSubtitle: {}, graphStage: statsStage },
  genealogyStats: () => ({ totalPeople: 1, genealogyCount: 1, baptizedCount: 1, unbaptizedCount: 0 }),
  baptismTimelineData: () => ({ entries: [], periodLabel: "par annee", scope: "Main" }),
  statsScopeLabel: () => "Main",
  escapeHtml,
  baptismTimelineViewHtml: () => "<div></div>",
  largestDescendantStatCard: () => "<section></section>",
  topSongStatCard: () => "<section></section>",
  longestNicknameStatCard: () => "<section></section>",
  roleStatsHtml: () => "",
  crossGroupsStatCard: () => "<section></section>",
  filiereStatsHtml: () => "<section></section>",
  bindBaptismTimelineControls: () => {},
  toggleStatCard: () => {},
  selectPersonFromGenealogy: (genealogyId, personId) => {
    selectedFromStats = `${genealogyId}:${personId}`;
  },
});
statChips[0].click({ stopPropagation() {} });
assert.equal(selectedFromStats, "main:a");

assert.deepEqual(timelineTickValues(10), [0, 3, 5, 8, 10]);
assert.deepEqual(timelineXAxisLabels([{ id: 1 }, { id: 2 }, { id: 3 }]).map((point) => point.id), [1, 2, 3]);
assert.deepEqual(uniquePeopleByStatIdentity([{ name: "Alice" }, { name: "Alice" }, { name: "Bob" }]).map((person) => person.name), ["Alice", "Bob"]);
assert.equal(nicknameStats([{ nickname: "abc", length: 3, person: people[0], genealogy: { id: "main", name: "Main" } }]).nickname, "abc");
assert.match(
  renderStatPeopleChips({
    entries: [{ person: people[0], genealogy: { id: "main", name: "Main" } }],
    emptyText: "Aucun",
    showGenealogy: true,
  }),
  /Main/
);
assert.match(
  renderTopSongStatCard({
    stats: { topSong: { name: "Song", count: 2, people: [] } },
    expandedStatKey: "",
    renderStatPeopleChips: () => "",
  }),
  /Song/
);

const upcoming = normaliseUpcomingBaptisms(
  [
    {
      id: "event-1",
      eventType: "bapteme",
      sponsorIds: ["a"],
      baptizedNames: ["Charlie"],
      regionId: "region",
      dateTime: "2026-05-12T18:00",
    },
    {
      id: "expired",
      eventType: "bapteme",
      sponsorIds: ["a"],
      baptizedNames: ["Old"],
      regionId: "region",
      dateTime: "2026-05-09T18:00",
    },
  ],
  new Date("2026-05-13T12:00:00")
);
assert.deepEqual(upcoming.map((event) => event.id), ["event-1"]);
assert.match(
  renderUpcomingSponsorSelectionHtml({
    sponsorIds: ["a"],
    people,
    displayName,
    getPersonFromPeople: (source, id) => source.find((person) => person.id === id),
  }),
  /Alice dit Ali/
);

assert.equal(escapeHtml("<strong>&"), "&lt;strong&gt;&amp;");
assert.equal(joinHtml([1, 2], (item) => `<b>${item}</b>`), "<b>1</b><b>2</b>");

console.log("features: ok");
