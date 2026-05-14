import {
  makeId,
  normaliseBaptismStatus,
  normaliseDateTimeLocal,
  normaliseNicknames,
  normaliseRoleId,
  normaliseRoles,
  normaliseUpcomingEventType,
  normalisedText,
  readDepth,
  stripAccents,
  toIdArray,
  uniqueIds,
} from "./modules/data.js";
import { wrappedLines } from "./modules/exports.js";
import { edgeGeometry } from "./modules/graph.js";
import { labelFromId, labelFromMap, labels as uiLabels } from "./modules/labels.js";
import { compareByFrenchLabel } from "./modules/stats.js";
import {
  activeGenealogyFromState,
  activePeopleFromGenealogyState,
  childGenealogiesFor,
  createAppState,
  createGenealogyIndex,
  loadStoredGenealogyState,
  loadStoredJson,
  loadStoredRecentPersonIds,
  mainGenealogyFromState,
  removeStoredValue,
  regionalGenealogyFor as regionalGenealogyForState,
  regionalScopeGenealogiesFor,
  saveStoredGenealogyState,
  saveStoredJson,
  saveStoredRecentPersonIds,
  storageKeys,
} from "./src/state.js";
import {
  adminRecentChangeLine,
  adminScopeLabel,
  findAdminRegionInfo,
  normaliseAdminRecentChanges,
  normaliseAdminSession,
  renderAdminToolsView,
} from "./src/features/admin/index.js";
import { applyAdminSessionAction } from "./src/features/admin/actions.js";
import { changeRegionalPasswordRequest, loginAdminRequest, logoutAdminRequest } from "./src/api/adminApi.js";
import { fetchCsrfToken } from "./src/api/authApi.js";
import { createDoleanceRequest, fetchDoleancesRequest, saveDoleancesRequest } from "./src/api/doleancesApi.js";
import { fetchGenealogyRequest, genealogySavePayload, saveGenealogyRequest } from "./src/api/genealogyApi.js";
import { canUseRemoteApi, readResponseMessage } from "./src/api/http.js";
import {
  adminDoleancePanelHtml,
  formatDoleanceDate,
  makeDoleance,
  normaliseDoleances,
  normaliseDoleanceType,
  pendingDoleanceCount,
  publicDoleancePanelHtml,
} from "./src/features/doleances/index.js";
import {
  buildGraphRings,
  createConnector,
  createGenerationBand,
  createGraphNodeCard,
  createRelationshipGenerationBand,
  createRelationshipLegend,
  flattenGroups,
  graphNodeCardClass,
  graphNodeInfoHtml,
  graphPersonCardHtml,
  limitedGroups,
  renderGraphView,
  renderNetworkView,
  renderNewcomersView,
  renderOverviewView,
  renderTreeView,
  walkByDepth,
} from "./src/features/graph/index.js";
import { setViewModeAction, updateGraphZoomAction } from "./src/features/graph/actions.js";
import {
  ceremonyEventKey,
  compactLine,
  createPeopleIndex,
  createPeopleSearchRows,
  displayName,
  getPersonFromPeople as getPersonFromPeopleFeature,
  nicknameText,
  normaliseCeremonyEvents,
  normaliseCeremonyType,
  normaliseCrossGroups,
  normaliseCrossGroupSize,
  normalisePeople,
  renderPeopleForm,
  renderPeopleDetails,
  savePeopleForm,
  sameStringArray,
  uniquePersonIdFrom,
  uniquePeopleById as uniquePeopleByIdFeature,
} from "./src/features/people/index.js";
import {
  addDraftPersonAction,
  removeDraftPersonAction,
  removeExtraCeremonyAction,
  sanitiseAdminSelectionAction,
  setAdminPersonSelectedAction,
  toggleAdminSelectionAction,
} from "./src/features/people/actions.js";
import {
  compareUpcomingBaptisms,
  normaliseUpcomingBaptisms,
  normaliseUpcomingBaptizedNames,
  renderUpcomingBaptismCardHtml,
  renderUpcomingConcernedSelectionHtml,
  renderUpcomingSponsorSelectionHtml,
} from "./src/features/upcoming/index.js";
import {
  addUpcomingConcernedAction,
  addUpcomingSponsorAction,
  captureUpcomingAnnouncementDraftAction,
  removeUpcomingConcernedAction,
  removeUpcomingSponsorAction,
} from "./src/features/upcoming/actions.js";
import {
  compareStatPeople,
  compareStatSource,
  nicknameStats,
  renderCrossGroupDetails as renderCrossGroupDetailsFeature,
  renderCrossGroupsStatCard,
  renderFilierePeopleDetails as renderFilierePeopleDetailsFeature,
  renderFiliereStatsGroupRow,
  renderFiliereStatsHtml,
  renderLargestDescendantStatCard,
  renderLongestNicknameStatCard,
  renderRoleStatCard,
  renderRoleStatsHtml,
  renderStatPeopleChips as renderStatPeopleChipsFeature,
  renderStatsView,
  renderTopSongStatCard,
  statToggleAttrs as statToggleAttrsFeature,
  statPersonKey,
  timelineTickValues,
  timelineXAxisLabels,
  uniquePeopleByStatIdentity,
} from "./src/features/stats/index.js";
import { createDialogService, createModalController } from "./src/ui/modal.js";
import { createToastController } from "./src/ui/toast.js";
import { escapeHtml, joinHtml } from "./src/ui/renderHelpers.js";

const defaultGenealogyPhotoSrc = "./assets/fetterama.png";
const roleResetVersion = 1;
const mainGenealogyId = "faluche-nationale";
const defaultRegionalGenealogyId = "faluche-alsacienne";
const defaultCooptageRoleId = "tva";
const oldDefaultGenealogyName = "Descendance de la K'fetteria";
const defaultGenealogyName = "Faluche Nationale";
const defaultRegionalGenealogyName = "La faluche alsacienne";
const maxCrossGroupSize = 10;
const maxJsonImportBytes = 8 * 1024 * 1024;
const maxImageUploadBytes = 2 * 1024 * 1024;
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
let _todayCache = null;
const mainGenealogyNameAliases = [
  defaultGenealogyName,
  "Faluche nationale",
  "La faluche nationale",
  "Faluche alsacienne",
  "La faluche alscacienne",
  "Faluche alscacienne",
  oldDefaultGenealogyName,
];

const legacyDefaultRoleIds = new Set(["tva", "geraldine", "gontran", "president-pow-wow"]);
const defaultRoleOptions = [];

const filiereOptions = [
  { id: "dentaire", label: "Dentaire", circular: "Violet", strip: "#6b2fb9", statGroup: "dentaire" },
  { id: "carab", label: "Medecine (Carab)", circular: "Amarante", strip: "#e52b50", statGroup: "medecine" },
  { id: "paramedical", label: "Paramedical - General", circular: "Rose", strip: "#ef86b9", statGroup: "paramedical" },
  { id: "paramedical-kinesitherapie", label: "Kinesitherapie", circular: "Rose", strip: "#ef86b9", statGroup: "paramedical" },
  { id: "paramedical-infirmier", label: "Infirmier", circular: "Rose", strip: "#ef86b9", statGroup: "paramedical" },
  { id: "paramedical-orthophonie", label: "Orthophonie", circular: "Rose", strip: "#ef86b9", statGroup: "paramedical" },
  { id: "pharma", label: "Pharmacie", circular: "Vert", strip: "#1f8f48", statGroup: "pharmacie" },
  { id: "sage-femme", label: "Sage femme", circular: "Bleu roi", strip: "#1747b5", statGroup: "sage-femme" },
  { id: "veterinaire", label: "Veterinaire", circular: "Bordeaux", strip: "#6d1f32", statGroup: "veterinaire" },
  { id: "aes", label: "AES", circular: "Gris", strip: "#8f9297", statGroup: "aes" },
  {
    id: "arts-spectacle-cinema-audiovisuel",
    label: "Arts du Spectacle, Cinema et Audiovisuel",
    circular: "Bordeaux",
    strip: "#6d1f32",
    statGroup: "arts-spectacle",
  },
  { id: "arts-visuels", label: "Arts visuels", circular: "Bleu clair", strip: "#7ec8e3", statGroup: "arts-visuels" },
  { id: "bts", label: "BTS", circular: "Blanc", strip: "#ffffff", statGroup: "bts" },
  { id: "communication", label: "Communication", circular: "Orange", strip: "#f28c28", statGroup: "communication" },
  {
    id: "cpge-hypokhagne-khagne",
    label: "Hypokhagne/Khagne",
    circular: "Marron",
    strip: "#7b4a2d",
    statGroup: "cpge",
  },
  { id: "cpge-scientifique", label: "Scientifique", circular: "Marron", strip: "#7b4a2d", statGroup: "cpge" },
  { id: "droit", label: "Droit", circular: "Rouge", strip: "#d3272f", statGroup: "droit" },
  {
    id: "economie-comptabilite",
    label: "Comptabilite (CCA/DCG)",
    circular: "Rouge avec lisere central mauve",
    strip: "linear-gradient(90deg, #d3272f 0 38%, #9b59b6 38% 62%, #d3272f 62% 100%)",
    statGroup: "economie",
  },
  {
    id: "economie-sciences-eco",
    label: "Sciences Eco",
    circular: "Rouge et mauve",
    strip: "linear-gradient(90deg, #d3272f 0 50%, #9b59b6 50% 100%)",
    statGroup: "economie",
  },
  {
    id: "enseignement-2nd-degre",
    label: "Enseignement 2nd degre",
    circular: "Couleur de la filiere enseignee",
    strip: "linear-gradient(90deg, #d3272f, #f0c928, #1f8f48, #7ec8e3, #9b59b6)",
    statGroup: "enseignement-2nd-degre",
  },
  {
    id: "histoire-archeologie",
    label: "Archeologie",
    circular: "Bleu et blanc",
    strip: "linear-gradient(90deg, #1747b5 0 50%, #ffffff 50% 100%)",
    statGroup: "histoire",
  },
  {
    id: "histoire",
    label: "Histoire",
    circular: "Bleu et blanc",
    strip: "linear-gradient(90deg, #1747b5 0 50%, #ffffff 50% 100%)",
    statGroup: "histoire",
  },
  {
    id: "histoire-art-beaux-arts",
    label: "Histoire de l'art / Beaux arts",
    circular: "Bleu et blanc",
    strip: "linear-gradient(90deg, #1747b5 0 50%, #ffffff 50% 100%)",
    statGroup: "histoire",
  },
  {
    id: "instituts-formations-nationaux",
    label: "Instituts de formations nationaux (INSEP, ...)",
    circular: "Bleu, Blanc et Rouge",
    strip: "linear-gradient(90deg, #1747b5 0 33%, #ffffff 33% 66%, #d3272f 66% 100%)",
    statGroup: "instituts-formations-nationaux",
  },
  { id: "iut", label: "IUT", circular: "Rose", strip: "#ef86b9", statGroup: "iut" },
  { id: "lettres", label: "Lettres", circular: "Jaune", strip: "#f0c928", statGroup: "lettres-langues" },
  { id: "lea", label: "LEA", circular: "Jaune", strip: "#f0c928", statGroup: "lettres-langues" },
  { id: "llce", label: "LLCE", circular: "Jaune", strip: "#f0c928", statGroup: "lettres-langues" },
  {
    id: "musique",
    label: "Musique",
    circular: "Blanc lisere noir",
    strip: "linear-gradient(90deg, #111111 0 12%, #ffffff 12% 88%, #111111 88% 100%)",
    statGroup: "musique",
  },
  {
    id: "politique-ihee",
    label: "IHEE",
    circular: "Bleu et Rouge",
    strip: "linear-gradient(90deg, #1747b5 0 50%, #d3272f 50% 100%)",
    statGroup: "politique-administration",
  },
  {
    id: "politique-ipag",
    label: "IPAG",
    circular: "Bleu et Rouge",
    strip: "linear-gradient(90deg, #1747b5 0 50%, #d3272f 50% 100%)",
    statGroup: "politique-administration",
  },
  {
    id: "science-po",
    label: "Science Po",
    circular: "Bleu et Rouge",
    strip: "linear-gradient(90deg, #1747b5 0 50%, #d3272f 50% 100%)",
    statGroup: "politique-administration",
  },
  { id: "sciences-ingenieur", label: "Sciences - De l'ingenieur", circular: "Mauve", strip: "#9b59b6", statGroup: "sciences" },
  { id: "sciences-general", label: "Sciences - General", circular: "Mauve", strip: "#9b59b6", statGroup: "sciences" },
  { id: "sciences-maths-eco", label: "Sciences - Maths-eco", circular: "Mauve", strip: "#9b59b6", statGroup: "sciences" },
  { id: "psychologie", label: "Sciences - Psychologie", circular: "Mauve", strip: "#9b59b6", statGroup: "sciences" },
  {
    id: "sciences-education-formation",
    label: "Sciences de l'education, de la formation et enseignement 1er degre",
    circular: "Bleu roi lisere blanc",
    strip: "linear-gradient(90deg, #ffffff 0 14%, #1747b5 14% 86%, #ffffff 86% 100%)",
    statGroup: "sciences-education-formation",
  },
  {
    id: "sciences-humaines-ethnologie",
    label: "Sciences humaines - Ethnologie",
    circular: "Jaune et Mauve",
    strip: "linear-gradient(90deg, #f0c928 0 50%, #9b59b6 50% 100%)",
    statGroup: "sciences-humaines",
  },
  {
    id: "sciences-humaines-general",
    label: "Sciences humaines - General",
    circular: "Jaune et Mauve",
    strip: "linear-gradient(90deg, #f0c928 0 50%, #9b59b6 50% 100%)",
    statGroup: "sciences-humaines",
  },
  {
    id: "geographie",
    label: "Sciences humaines - Geographie",
    circular: "Jaune et Mauve",
    strip: "linear-gradient(90deg, #f0c928 0 50%, #9b59b6 50% 100%)",
    statGroup: "sciences-humaines",
  },
  {
    id: "sociologie",
    label: "Sciences humaines - Sociologie",
    circular: "Jaune et Mauve",
    strip: "linear-gradient(90deg, #f0c928 0 50%, #9b59b6 50% 100%)",
    statGroup: "sciences-humaines",
  },
  {
    id: "staps",
    label: "Sciences humaines - STAPS",
    circular: "Jaune et Mauve",
    strip: "linear-gradient(90deg, #f0c928 0 50%, #9b59b6 50% 100%)",
    statGroup: "sciences-humaines",
  },
  {
    id: "theologie-catholique",
    label: "Catholique",
    circular: "Blanc et Rouge",
    strip: "linear-gradient(90deg, #ffffff 0 50%, #d3272f 50% 100%)",
    statGroup: "theologie",
  },
  {
    id: "theologie-protestante",
    label: "Protestante",
    circular: "Blanc et Rouge",
    strip: "linear-gradient(90deg, #ffffff 0 50%, #d3272f 50% 100%)",
    statGroup: "theologie",
  },
  { id: "general", label: "General", circular: "Vert", strip: "#1f8f48", statGroup: "ecoles-general" },
  {
    id: "ecole-architecture",
    label: "Ecole d'architecture",
    circular: "Vert et Bleu ciel",
    strip: "linear-gradient(90deg, #1f8f48 0 50%, #7ec8e3 50% 100%)",
    statGroup: "ecoles-general",
  },
  {
    id: "ecole-commerce",
    label: "Ecole de commerce",
    circular: "Vert et Rouge",
    strip: "linear-gradient(90deg, #1f8f48 0 50%, #d3272f 50% 100%)",
    statGroup: "ecoles-general",
  },
  {
    id: "ecole-communication",
    label: "Ecole de communication",
    circular: "Vert et Orange",
    strip: "linear-gradient(90deg, #1f8f48 0 50%, #f28c28 50% 100%)",
    statGroup: "ecoles-general",
  },
  {
    id: "ecole-traduction",
    label: "Ecole de traduction",
    circular: "Vert et Jaune",
    strip: "linear-gradient(90deg, #1f8f48 0 50%, #f0c928 50% 100%)",
    statGroup: "ecoles-general",
  },
  {
    id: "ecole-militaire",
    label: "Ecole militaire",
    circular: "Vert et Marron",
    strip: "linear-gradient(90deg, #1f8f48 0 50%, #7b4a2d 50% 100%)",
    statGroup: "ecoles-general",
  },
];

const filiereLegacyIds = {
  science: "sciences-general",
  lettre: "lettres",
};

const filiereStatGroups = [
  { id: "dentaire", label: "Dentaire" },
  { id: "medecine", label: "Medecine" },
  { id: "paramedical", label: "Paramedical" },
  { id: "pharmacie", label: "Pharmacie" },
  { id: "sage-femme", label: "Sage-Femme" },
  { id: "veterinaire", label: "Veterinaire" },
  { id: "aes", label: "AES" },
  { id: "arts-spectacle", label: "Arts du Spectacle, Cinema et Audiovisuel" },
  { id: "arts-visuels", label: "Arts visuels" },
  { id: "bts", label: "BTS" },
  { id: "communication", label: "Communication" },
  { id: "cpge", label: "CPGE (Classe Preparatoire aux Grandes Ecoles)" },
  { id: "droit", label: "Droit" },
  { id: "economie", label: "Economie" },
  { id: "enseignement-2nd-degre", label: "Enseignement 2nd degre" },
  { id: "histoire", label: "Histoire" },
  { id: "instituts-formations-nationaux", label: "Instituts de formations nationaux (INSEP, ...)" },
  { id: "iut", label: "IUT" },
  { id: "lettres-langues", label: "Lettres et Langues, Science du Langage" },
  { id: "musique", label: "Musique" },
  { id: "politique-administration", label: "Politique et Administration" },
  { id: "sciences", label: "Sciences" },
  { id: "sciences-education-formation", label: "Sciences de l'education, de la formation et enseignement 1er degre" },
  { id: "sciences-humaines", label: "Sciences Humaines" },
  { id: "theologie", label: "Theologie" },
  { id: "ecoles-general", label: "General et ecoles" },
];

const initialGenealogyState = loadStoredGenealogyState({ normaliseGenealogyState });
const peopleIndexCache = new WeakMap();
const peopleSearchCache = new WeakMap();
const genealogyIndexCache = new WeakMap();

const state = createAppState({
  initialGenealogyState,
  activePeople,
  recentPersonIds: loadStoredRecentPersonIds({ normaliseRecentPersonEntries }),
  doleances: loadDoleancesLocal(),
});

const els = {
  brandMark: document.querySelector("#brandMark"),
  genealogyTitle: document.querySelector("#genealogyTitle"),
  genealogyMenu: document.querySelector(".genealogy-menu"),
  genealogyList: document.querySelector("#genealogyList"),
  addGenealogyButton: document.querySelector("#addGenealogyButton"),
  renameGenealogyButton: document.querySelector("#renameGenealogyButton"),
  changeGenealogyPhotoButton: document.querySelector("#changeGenealogyPhotoButton"),
  deleteGenealogyButton: document.querySelector("#deleteGenealogyButton"),
  searchMenu: document.querySelector(".search-menu"),
  searchInput: document.querySelector("#searchInput"),
  personForm: document.querySelector("#personForm"),
  formErrors: document.querySelector("#formErrors"),
  formTitle: document.querySelector("#formTitle"),
  genealogyTargetField: document.querySelector("#genealogyTargetField"),
  genealogyTargetInput: document.querySelector("#genealogyTargetInput"),
  nameInput: document.querySelector("#nameInput"),
  nicknameInput: document.querySelector("#nicknameInput"),
  nickname2Input: document.querySelector("#nickname2Input"),
  nickname3Input: document.querySelector("#nickname3Input"),
  rolesInput: document.querySelector("#rolesInput"),
  ceremonyTypeInput: document.querySelector("#ceremonyTypeInput"),
  baptismInput: document.querySelector("#baptismInput"),
  baptismCityInput: document.querySelector("#baptismCityInput"),
  baptismStatusInput: document.querySelector("#baptismStatusInput"),
  songInput: document.querySelector("#songInput"),
  filiereInput: document.querySelector("#filiereInput"),
  sponsorSearchInput: document.querySelector("#sponsorSearchInput"),
  sponsorOptions: document.querySelector("#sponsorOptions"),
  selectedSponsorsList: document.querySelector("#selectedSponsorsList"),
  heartSponsorPicker: document.querySelector("#heartSponsorPicker"),
  addHeartSponsorButton: document.querySelector("#addHeartSponsorButton"),
  selectedHeartSponsorsList: document.querySelector("#selectedHeartSponsorsList"),
  extraCeremonyTypeInput: document.querySelector("#extraCeremonyTypeInput"),
  extraCeremonyCityInput: document.querySelector("#extraCeremonyCityInput"),
  extraCeremonyNicknameInput: document.querySelector("#extraCeremonyNicknameInput"),
  extraCeremonySponsorsInput: document.querySelector("#extraCeremonySponsorsInput"),
  addExtraCeremonyButton: document.querySelector("#addExtraCeremonyButton"),
  extraCeremoniesList: document.querySelector("#extraCeremoniesList"),
  crossGroupSizeInput: document.querySelector("#crossGroupSizeInput"),
  crossGroupPicker: document.querySelector("#crossGroupPicker"),
  addCrossMemberButton: document.querySelector("#addCrossMemberButton"),
  selectedCrossMembersList: document.querySelector("#selectedCrossMembersList"),
  clearCrossGroupButton: document.querySelector("#clearCrossGroupButton"),
  fillotInput: document.querySelector("#fillotInput"),
  attachFillotButton: document.querySelector("#attachFillotButton"),
  newFillotButton: document.querySelector("#newFillotButton"),
  currentFillotsList: document.querySelector("#currentFillotsList"),
  savePersonButton: document.querySelector("#savePersonButton"),
  mobileSavePersonButton: document.querySelector("#mobileSavePersonButton"),
  deleteButton: document.querySelector("#deleteButton"),
  newButton: document.querySelector("#newButton"),
  detailsPanel: document.querySelector("#detailsPanel"),
  graphStage: document.querySelector("#graphStage"),
  graphExitButton: document.querySelector("#graphExitButton"),
  focusTitle: document.querySelector("#focusTitle"),
  focusSubtitle: document.querySelector("#focusSubtitle"),
  ancestorDepthInput: document.querySelector("#ancestorDepthInput"),
  descendantDepthInput: document.querySelector("#descendantDepthInput"),
  showEditorInput: document.querySelector("#showEditorInput"),
  showEditorButton: document.querySelector("#showEditorButton"),
  treeModeButton: document.querySelector("#treeModeButton"),
  networkModeButton: document.querySelector("#networkModeButton"),
  overviewModeButton: document.querySelector("#overviewModeButton"),
  newcomersModeButton: document.querySelector("#newcomersModeButton"),
  upcomingModeButton: document.querySelector("#upcomingModeButton"),
  statsModeButton: document.querySelector("#statsModeButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomResetButton: document.querySelector("#zoomResetButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  adminButton: document.querySelector("#adminButton"),
  serverStatus: document.querySelector("#serverStatus"),
  doleanceButton: document.querySelector("#doleanceButton"),
  importInput: document.querySelector("#importInput"),
  adminImportAllInput: document.querySelector("#adminImportAllInput"),
  genealogyPhotoInput: document.querySelector("#genealogyPhotoInput"),
  exportButton: document.querySelector("#exportButton"),
  doleancePanel: document.querySelector("#doleancePanel"),
  adminPanel: document.querySelector("#adminPanel"),
  adminExportActiveButton: document.querySelector("#adminExportActiveButton"),
  adminExportAllButton: document.querySelector("#adminExportAllButton"),
  adminImportActiveButton: document.querySelector("#adminImportActiveButton"),
  adminImportAllButton: document.querySelector("#adminImportAllButton"),
  adminPeopleTools: document.querySelector("#adminPeopleTools"),
  appModalRoot: document.querySelector("#appModalRoot"),
  toastStack: document.querySelector("#toastStack"),
};

const viewModeButtons = [
  { button: els.treeModeButton, mode: "tree" },
  { button: els.networkModeButton, mode: "network" },
  { button: els.overviewModeButton, mode: "overview" },
  { button: els.newcomersModeButton, mode: "newcomers" },
  { button: els.upcomingModeButton, mode: "upcoming" },
  { button: els.statsModeButton, mode: "stats" },
];
const draftPersonButtons = [
  { button: els.addHeartSponsorButton, key: "draftHeartSponsorIds", picker: els.heartSponsorPicker },
];
const adminCanUseActiveGenealogy = () => !state.adminMode || genealogyInAdminScope(activeGenealogy());
const adminActionButtons = [
  [els.adminExportActiveButton, adminCanUseActiveGenealogy, "Cet admin regional ne peut pas exporter cet arbre.", exportActiveGenealogyJson],
  [els.adminExportAllButton, isGeneralAdmin, "Seul l'admin general peut exporter toutes les donnees.", exportAllGenealogyJson],
  [els.adminImportActiveButton, adminCanUseActiveGenealogy, "Cet admin regional ne peut pas importer dans cet arbre.", () => els.importInput.click()],
  [els.adminImportAllButton, isGeneralAdmin, "Seul l'admin general peut importer toutes les donnees.", () => els.adminImportAllInput.click()],
];
const removableChipLists = [
  [els.selectedSponsorsList, "[data-remove-sponsor]", (chip) => removeDraftPerson("draftSponsorIds", chip.dataset.removeSponsor)],
  [els.selectedHeartSponsorsList, "[data-remove-heart-sponsor]", (chip) => removeDraftPerson("draftHeartSponsorIds", chip.dataset.removeHeartSponsor)],
  [els.extraCeremoniesList, "[data-remove-extra-ceremony]", (chip) => removeExtraCeremony(chip.dataset.removeExtraCeremony)],
  [els.selectedCrossMembersList, "[data-remove-cross-member]", (chip) => removeDraftPerson("draftCrossMemberIds", chip.dataset.removeCrossMember)],
  [els.currentFillotsList, "[data-remove-fillot]", (chip) => removeClassicFillot(chip.dataset.removeFillot)],
];

const dialogService = createDialogService({
  modalController: createModalController({ modalRoot: els.appModalRoot }),
  toastController: createToastController({ toastStack: els.toastStack, documentRef: document, windowRef: window }),
});
const { showToast, showMessage, askConfirm, askText } = dialogService;

setInitialSiteFocus();
setupDeviceMode();
setServerStatus(canUseRemoteApi() ? "saving" : "offline");
if (initialGenealogyState.rolesWereReset || initialGenealogyState.privateFieldsWereStripped || initialGenealogyState.personPhotosWereStripped) {
  persistLocal();
}

els.genealogyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-genealogy-id]");
  if (!button) return;
  const selectedGenealogy = genealogyById(button.dataset.genealogyId);
  if (!selectedGenealogy) return;
  state.userSelectedGenealogy = true;
  state.expandedGenealogyRegionId = isRegionalGenealogy(selectedGenealogy)
    ? selectedGenealogy.id
    : regionalGenealogyFor(selectedGenealogy)?.id || "";
  switchGenealogy(selectedGenealogy.id, !isRegionalGenealogy(selectedGenealogy));
  if (isRegionalGenealogy(selectedGenealogy)) {
    persistLocal();
    renderGenealogyMenu();
    els.genealogyMenu.open = true;
    return;
  }
  closeGenealogyMenu();
});

els.addGenealogyButton.addEventListener("click", async () => {
  if (!requireAdminForEdit()) return;
  const current = activeGenealogy();
  const suggestedType = isMainGenealogy(current) ? "region" : "famille";
  const typeInput = await askText("Nouvel arbre", "Choisis le niveau de la nouvelle genealogie.", {
    label: "Niveau : region ou famille",
    value: suggestedType,
    required: true,
  });
  if (typeInput === null) return;
  const type = normaliseNewGenealogyType(typeInput);
  if (!type) {
    await showMessage("Niveau invalide", 'Indique "region" ou "famille".');
    return;
  }
  if (isRegionalAdmin() && type !== "family") {
    await showMessage("Action bloquee", "Un admin regional peut uniquement creer des familles dans sa region.");
    return;
  }
  const parentRegion = type === "family" ? adminRegion() || roleRegionForGenealogy(current) : null;
  if (type === "family" && !parentRegion) {
    await showMessage("Region requise", "Ouvre d'abord la faluche de region/ville dans laquelle creer cette famille.");
    return;
  }

  const name = await askText("Nom de l'arbre", "Donne un nom clair a cette genealogie.", {
    label: "Nom",
    value: type === "region" ? "Nouvelle faluche de region" : "Nouvelle famille",
    required: true,
  });
  if (name === null) return;
  const cleanName = name.trim();
  if (!cleanName) {
    await showMessage("Nom obligatoire", "Le nom de la genealogie est obligatoire.");
    return;
  }

  const genealogy = {
    id: uniqueGenealogyId(cleanName),
    name: cleanName,
    type,
    parentId: type === "region" ? mainGenealogyId : parentRegion.id,
    photoData: "",
    people: [],
    customRoles: [],
    cooptageRoleId: type === "region" ? defaultCooptageRoleId : "",
    adminPassword: "",
  };
  syncActiveGenealogy();
  state.genealogies = [...state.genealogies, genealogy];
  state.genealogies = withMainGenealogyPeople(state.genealogies);
  switchGenealogy(genealogy.id, false);
  persist();
  if (await askConfirm("Photo de l'arbre", "Choisir une photo personnalisee pour cette genealogie ?", {
    confirmText: "Choisir une photo",
    cancelText: "Garder la photo par defaut",
  })) {
    requestGenealogyPhoto(genealogy.id);
  }
});

els.renameGenealogyButton.addEventListener("click", async () => {
  if (!requireAdminForEdit()) return;
  const current = activeGenealogy();
  if (state.adminMode && !genealogyInAdminScope(current)) {
    await showMessage("Action bloquee", "Cet admin regional ne peut pas modifier cette genealogie.");
    return;
  }
  const name = await askText("Renommer l'arbre", "Choisis le nouveau nom de la genealogie.", {
    label: "Nouveau nom",
    value: current.name,
    required: true,
  });
  if (name === null) return;
  const cleanName = name.trim();
  if (!cleanName) {
    await showMessage("Nom obligatoire", "Le nom de la genealogie est obligatoire.");
    return;
  }

  current.name = cleanName;
  persist();
  render();
});

els.deleteGenealogyButton.addEventListener("click", async () => {
  if (!requireAdminForEdit()) return;
  const current = activeGenealogy();
  if (isRegionalAdmin() && !isFamilyGenealogy(current)) {
    await showMessage("Action bloquee", "Un admin regional peut supprimer uniquement les familles de sa region.");
    return;
  }
  if (state.adminMode && !genealogyInAdminScope(current)) {
    await showMessage("Action bloquee", "Cet admin regional ne peut pas supprimer cette genealogie.");
    return;
  }
  if (isMainGenealogy(current)) {
    await showMessage("Suppression impossible", "La Faluche Nationale ne peut pas etre supprimee.");
    return;
  }
  if (state.genealogies.length <= 1) {
    await showMessage("Suppression impossible", "Garde au moins une genealogie.");
    return;
  }
  const descendants = isRegionalGenealogy(current) ? childGenealogies(current.id) : [];
  const extra = descendants.length ? ` et ses ${descendants.length} famille(s)` : "";
  const confirmed = await askConfirm(
    "Supprimer l'arbre",
    `Cette action supprimera toute la genealogie "${current.name}"${extra}. Les fiches et leurs liens seront retires.`,
    { confirmText: "Supprimer", cancelText: "Annuler", danger: true, requiredText: "SUPPRIMER" }
  );
  if (!confirmed) return;

  const removedIds = new Set([current.id, ...descendants.map((genealogy) => genealogy.id)]);
  state.genealogies = withMainGenealogyPeople(state.genealogies.filter((item) => !removedIds.has(item.id)));
  state.activeGenealogyId = mainGenealogy().id;
  state.people = activeGenealogy().people;
  resetScopeSelection(false);
  persist();
  render();
});

els.changeGenealogyPhotoButton.addEventListener("click", async () => {
  if (!requireAdminForEdit()) return;
  if (state.adminMode && !genealogyInAdminScope(activeGenealogy())) {
    await showMessage("Action bloquee", "Cet admin regional ne peut pas modifier cette genealogie.");
    return;
  }
  requestGenealogyPhoto(activeGenealogy().id);
});

els.adminButton.addEventListener("click", async () => {
  if (state.adminMode) {
    await exitAdminMode();
    return;
  }

  const password = await askText("Connexion admin", "Entre le mot de passe administrateur.", {
    label: "Mot de passe",
    type: "password",
    required: true,
    confirmText: "Se connecter",
  });
  if (password === null) return;
  const session = await loginAdmin(password.trim());
  if (session === undefined) return;
  if (!session) {
    await showMessage("Connexion refusee", "Mot de passe incorrect.");
    return;
  }

  state.adminMode = true;
  applyAdminSession(session);
  state.adminSelectedPersonIds = [];
  state.showEditor = true;
  if (isRegionalAdmin()) {
    switchGenealogy(state.adminRegionId, false);
    const canStayAdmin = await promptRegionalPasswordChangeIfRequired();
    if (canStayAdmin) await showAdminRecentChanges(session);
    return;
  }
  render();
  loadDoleancesForAdmin();
  await showAdminRecentChanges(session);
});

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  const match = state.query ? filteredPeople()[0] : null;
  if (match) {
    state.selectedId = match.id;
    state.mode = "tree";
  }
  render();
});

els.searchMenu?.addEventListener("toggle", () => {
  if (!els.searchMenu.open || !els.searchInput) return;
  window.requestAnimationFrame(() => {
    els.searchInput.focus({ preventScroll: true });
  });
});

els.personForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveCurrentForm();
});

els.personForm.addEventListener("input", markFormDirty);
els.personForm.addEventListener("change", markFormDirty);

els.personForm.addEventListener("click", (event) => {
  const stepButton = event.target.closest("[data-form-step-target]");
  if (stepButton) {
    openFormStep(stepButton.dataset.formStepTarget);
    return;
  }

});

els.newButton.addEventListener("click", () => {
  state.selectedId = null;
  state.formTargetGenealogyId = state.activeGenealogyId;
  state.prefillSponsorIds = [];
  resetFormDraft();
  clearFormDraftLocal();
  markFormDirty();
  render();
  els.nameInput.focus();
});

els.sponsorSearchInput.addEventListener("input", () => {
  addDraftPersonFromSearch("draftSponsorIds", els.sponsorSearchInput, { exactOnly: true });
});

els.sponsorSearchInput.addEventListener("change", () => {
  addDraftPersonFromSearch("draftSponsorIds", els.sponsorSearchInput, { exactOnly: true });
});

els.sponsorSearchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addDraftPersonFromSearch("draftSponsorIds", els.sponsorSearchInput, { exactOnly: false });
});

els.genealogyTargetInput.addEventListener("change", (event) => {
  markFormDirty();
  state.formTargetGenealogyId = event.target.value || state.activeGenealogyId;
  keepDraftPeopleInFormTarget();
  renderForm();
});

els.baptismCityInput.addEventListener("change", async () => {
  if (state.formPersonId !== "__new__") return;
  const cityGenealogy = genealogyForBaptismCity(els.baptismCityInput.value);
  if (!cityGenealogy || cityGenealogy.id === state.formTargetGenealogyId) return;
  const confirmed = await askConfirm(
    "Region detectee",
    `La ville de bapteme semble correspondre a "${cityGenealogy.name}". Utiliser cet arbre comme destination ?`,
    { confirmText: "Utiliser cette region", cancelText: "Garder le choix actuel" }
  );
  if (!confirmed) return;
  state.formTargetGenealogyId = cityGenealogy.id;
  keepDraftPeopleInFormTarget();
  markFormDirty();
  renderForm();
});

els.deleteButton.addEventListener("click", async () => {
  if (!requireAdminForEdit()) return;
  if (!state.selectedId) return;
  await deletePersonById(state.selectedId, true);
});

viewModeButtons.forEach(({ button, mode }) => {
  button.addEventListener("click", () => setViewMode(mode));
});

els.importInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const importedPeople = await readPeopleJsonFile(file);
    if (!importedPeople.length) {
      await showMessage("Import impossible", "Le fichier JSON ne contient aucune fiche valide.");
      return;
    }

    const current = activeGenealogy();
    if (state.adminMode && !genealogyInAdminScope(current)) {
      await showMessage("Action bloquee", "Cet admin regional ne peut pas importer dans cet arbre.");
      return;
    }
    const confirmed = await confirmPeopleImportPreview(importedPeople, current);
    if (!confirmed) return;

    state.people = importedPeople;
    resetScopeSelection();
    persist();
    render();
  } catch (error) {
    await showMessage("Import impossible", error.message || "Impossible d'importer ce fichier JSON.");
  } finally {
    event.target.value = "";
  }
});

els.adminImportAllInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  if (!isGeneralAdmin()) {
    await showMessage("Action bloquee", "Seul l'admin general peut importer toutes les donnees.");
    event.target.value = "";
    return;
  }

  try {
    const importedState = await readGenealogyJsonFile(file);
    const count = importedState.genealogies.reduce((total, genealogy) => total + genealogy.people.length, 0);
    const confirmed = await confirmFullImportPreview(importedState, count);
    if (!confirmed) return;

    syncActiveGenealogy();
    state.genealogies = importedState.genealogies;
    state.activeGenealogyId = importedState.activeGenealogyId;
    state.genealogies = withMainGenealogyPeople(state.genealogies);
    state.people = activeGenealogy().people;
    resetScopeSelection();
    persist();
    render();
  } catch (error) {
    await showMessage("Import impossible", error.message || "Impossible d'importer toutes les donnees.");
  } finally {
    event.target.value = "";
  }
});

els.genealogyPhotoInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  const targetId = state.pendingGenealogyPhotoId || activeGenealogy().id;
  if (!file) {
    state.pendingGenealogyPhotoId = null;
    event.target.value = "";
    return;
  }

  try {
    const photoData = await readImageFile(file);
    state.genealogies = state.genealogies.map((item) =>
      item.id === targetId ? { ...item, photoData } : item
    );
    persist();
    render();
  } catch (error) {
    await showMessage("Image refusee", error.message || "La photo de famille ne peut pas etre chargee.");
  } finally {
    state.pendingGenealogyPhotoId = null;
    event.target.value = "";
  }
});

els.zoomOutButton.addEventListener("click", () => updateGraphZoom(-0.1));
els.zoomResetButton.addEventListener("click", () => updateGraphZoom(0, true));
els.zoomInButton.addEventListener("click", () => updateGraphZoom(0.1));

els.graphExitButton?.addEventListener("click", () => {
  exitGraphViewport();
});

els.ancestorDepthInput.addEventListener("input", () => {
  state.ancestorDepth = readDepth(els.ancestorDepthInput.value);
  render();
});

els.descendantDepthInput.addEventListener("input", () => {
  state.descendantDepth = readDepth(els.descendantDepthInput.value);
  render();
});

els.showEditorInput.addEventListener("change", () => {
  state.showEditor = els.showEditorInput.checked;
  renderLayoutOptions();
});

els.showEditorButton?.addEventListener("click", () => {
  state.showEditor = true;
  renderLayoutOptions();
  scrollToPersonForm();
});

els.graphStage.addEventListener("change", (event) => {
  const eventToggle = event.target.closest("[data-upcoming-select]");
  if (eventToggle) {
    state.upcomingSelectedEventIds = eventToggle.checked
      ? uniqueIds([...state.upcomingSelectedEventIds, eventToggle.value])
      : state.upcomingSelectedEventIds.filter((id) => id !== eventToggle.value);
    renderGraph();
  }
});

els.graphStage.addEventListener("submit", async (event) => {
  const announcementForm = event.target.closest("[data-upcoming-form]");
  if (announcementForm) {
    event.preventDefault();
    await addUpcomingBaptism(announcementForm);
    return;
  }

  const responseForm = event.target.closest("[data-upcoming-rsvp]");
  if (responseForm) {
    event.preventDefault();
    await requestUpcomingAttendance(responseForm);
  }
});

els.graphStage.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  const sponsorSearch = event.target.closest("[data-upcoming-sponsor-search]");
  if (sponsorSearch) {
    event.preventDefault();
    await addUpcomingSponsorFromSearch(sponsorSearch.closest("[data-upcoming-form]"));
    return;
  }
  const concernedSearch = event.target.closest("[data-upcoming-concerned-search]");
  if (concernedSearch) {
    event.preventDefault();
    await addUpcomingConcernedFromSearch(concernedSearch.closest("[data-upcoming-form]"));
  }
});

els.graphStage.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-upcoming-delete]");
  if (deleteButton) {
    await deleteUpcomingBaptism(deleteButton.dataset.upcomingDelete);
    return;
  }

  const formToggleButton = event.target.closest("[data-upcoming-form-toggle]");
  if (formToggleButton) {
    captureUpcomingAnnouncementDraft(els.graphStage.querySelector("[data-upcoming-form]"));
    const nextKind = formToggleButton.dataset.upcomingFormToggle === "cooptage" ? "cooptage" : "ceremony";
    const sameKind = state.upcomingAnnouncementKind === nextKind;
    state.showUpcomingAnnouncementForm = sameKind ? !state.showUpcomingAnnouncementForm : true;
    state.upcomingAnnouncementKind = nextKind;
    if (!sameKind) {
      state.upcomingSponsorIds = [];
      state.upcomingConcernedIds = [];
      state.upcomingAnnouncementDraft = { eventType: nextKind === "cooptage" ? "cooptage" : "bapteme" };
    }
    renderGraph();
    return;
  }

  const sponsorAddButton = event.target.closest("[data-upcoming-sponsor-add]");
  if (sponsorAddButton) {
    await addUpcomingSponsorFromSearch(sponsorAddButton.closest("[data-upcoming-form]"));
    return;
  }

  const sponsorRemoveButton = event.target.closest("[data-upcoming-sponsor-remove]");
  if (sponsorRemoveButton) {
    removeUpcomingSponsor(sponsorRemoveButton.dataset.upcomingSponsorRemove, sponsorRemoveButton.closest("[data-upcoming-form]"));
    return;
  }

  const concernedAddButton = event.target.closest("[data-upcoming-concerned-add]");
  if (concernedAddButton) {
    await addUpcomingConcernedFromSearch(concernedAddButton.closest("[data-upcoming-form]"));
    return;
  }

  const concernedRemoveButton = event.target.closest("[data-upcoming-concerned-remove]");
  if (concernedRemoveButton) {
    removeUpcomingConcerned(concernedRemoveButton.dataset.upcomingConcernedRemove, concernedRemoveButton.closest("[data-upcoming-form]"));
    return;
  }

  const toggleButton = event.target.closest("[data-upcoming-toggle]");
  if (toggleButton) {
    state.expandedUpcomingId = state.expandedUpcomingId === toggleButton.dataset.upcomingToggle ? "" : toggleButton.dataset.upcomingToggle;
    renderGraph();
  }
});

draftPersonButtons.forEach(({ button, key, picker }) => {
  button.addEventListener("click", () => addDraftPerson(key, picker.value));
});

els.addExtraCeremonyButton.addEventListener("click", async () => {
  const type = els.extraCeremonyTypeInput.value === "confirmation" ? "confirmation" : "adoption";
  const city = els.extraCeremonyCityInput.value.trim();
  const nickname = els.extraCeremonyNicknameInput.value.trim();
  const sponsorIds = [...els.extraCeremonySponsorsInput.selectedOptions].map((option) => option.value);
  if (!city) {
    await showMessage("Ville requise", "Ajoute une ville pour cette ceremonie.");
    return;
  }
  markFormDirty();
  state.draftCeremonyEvents = normaliseCeremonyEvents([
    ...state.draftCeremonyEvents,
    { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, city, nickname, sponsorIds },
  ]);
  els.extraCeremonyCityInput.value = "";
  els.extraCeremonyNicknameInput.value = "";
  [...els.extraCeremonySponsorsInput.options].forEach((option) => {
    option.selected = false;
  });
  renderForm();
});

els.addCrossMemberButton.addEventListener("click", async () => {
  const id = els.crossGroupPicker.value;
  if (!id) return;
  if (!state.draftCrossGroupSize) {
    state.draftCrossGroupSize = 2;
    els.crossGroupSizeInput.value = "2";
  }
  const maxOthers = state.draftCrossGroupSize - 1;
  if (state.draftCrossMemberIds.length >= maxOthers) {
    await showMessage("Croisee complete", "Retire d'abord une personne de la croisee, ou augmente le nombre de personnes.");
    return;
  }
  addDraftPerson("draftCrossMemberIds", id);
});

els.crossGroupSizeInput.addEventListener("change", () => {
  markFormDirty();
  state.draftCrossGroupSize = Number(els.crossGroupSizeInput.value || 0);
  if (!state.draftCrossGroupSize) state.draftCrossMemberIds = [];
  renderForm();
});

els.clearCrossGroupButton.addEventListener("click", () => {
  markFormDirty();
  state.draftCrossGroupSize = 0;
  state.draftCrossMemberIds = [];
  renderForm();
});

removableChipLists.forEach(([container, selector, remove]) => {
  container.addEventListener("click", (event) => {
    const chip = event.target.closest(selector);
    if (chip) remove(chip);
  });
});

els.graphStage.addEventListener("wheel", (event) => {
  if (!event.ctrlKey) return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.08 : 0.08;
  updateGraphZoomAction(state, delta);
  applyGraphZoom();
});

els.graphStage.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" && isSmartphoneViewport()) return;
  const startedNodeCard = event.target.closest(".node-card");
  const startedOnNodeCard = Boolean(startedNodeCard);
  const startedOnControl = event.target.closest(
    "input, select, textarea, a, label, summary, [data-stat-toggle], .timeline-controls, .timeline-month-controls"
  );
  const startedOnButton = Boolean(event.target.closest("button"));
  if (event.button !== 0 || startedOnControl || (startedOnButton && !startedOnNodeCard)) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const startLeft = els.graphStage.scrollLeft;
  const startTop = els.graphStage.scrollTop;
  els.graphStage.setPointerCapture(event.pointerId);
  els.graphStage.classList.add("is-panning");
  let didMove = false;
  let isFinished = false;

  const move = (moveEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) didMove = true;
    els.graphStage.scrollLeft = startLeft - (moveEvent.clientX - startX);
    els.graphStage.scrollTop = startTop - (moveEvent.clientY - startY);
  };
  const up = (upEvent) => {
    if (isFinished) return;
    isFinished = true;
    els.graphStage.classList.remove("is-panning");
    if (els.graphStage.hasPointerCapture?.(upEvent.pointerId)) {
      els.graphStage.releasePointerCapture(upEvent.pointerId);
    }
    els.graphStage.removeEventListener("pointermove", move);
    els.graphStage.removeEventListener("pointerup", up);
    els.graphStage.removeEventListener("pointercancel", up);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    if (!didMove && startedNodeCard?.dataset.personId) {
      els.graphStage.addEventListener("click", preventPannedClick, { once: true, capture: true });
      selectGraphNodeCard(startedNodeCard);
      return;
    }
    if (didMove) {
      els.graphStage.addEventListener("click", preventPannedClick, { once: true, capture: true });
    }
  };
  els.graphStage.addEventListener("pointermove", move);
  els.graphStage.addEventListener("pointerup", up);
  els.graphStage.addEventListener("pointercancel", up);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
});

els.attachFillotButton.addEventListener("click", () => {
  const sponsor = getPerson(state.selectedId);
  const fillotId = els.fillotInput.value;
  if (!sponsor || !fillotId) return;

  if (!setClassicSponsorLink(fillotId, sponsor.id, true)) {
    void showMessage("Lien impossible", "Ce fillot ne peut pas etre rattache depuis l'arbre ouvert.");
  }
});

els.newFillotButton.addEventListener("click", () => {
  const sponsor = getPerson(state.selectedId);
  if (!sponsor) return;

  state.prefillSponsorIds = [sponsor.id];
  state.formTargetGenealogyId = state.activeGenealogyId;
  state.selectedId = null;
  resetFormDraft();
  markFormDirty();
  render();
  els.nameInput.focus();
});

els.exportButton.addEventListener("click", async () => {
  await exportFocusedPdf();
});

els.doleanceButton.addEventListener("click", () => {
  openDoleancePanel();
});

els.doleancePanel.addEventListener("click", async (event) => {
  const close = event.target.closest("[data-doleance-close]");
  if (close || event.target === els.doleancePanel) {
    state.doleancePanelOpen = false;
    renderDoleancePanel();
    renderDoleanceButton();
    return;
  }

  const pendingButton = event.target.closest("[data-doleance-pending]");
  if (pendingButton) {
    await updateDoleanceStatus(pendingButton.dataset.doleancePending, "pending");
  }
});

els.doleancePanel.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-doleance-form]");
  if (!form) return;
  event.preventDefault();
  await submitDoleance(form);
});

els.doleancePanel.addEventListener("change", async (event) => {
  const readToggle = event.target.closest("[data-doleance-read]");
  if (!readToggle) return;
  await updateDoleanceStatus(readToggle.dataset.doleanceRead, readToggle.checked ? "resolved" : "pending");
});

adminActionButtons.forEach(([button, allowed, deniedMessage, action]) => {
  button.addEventListener("click", async () => {
    if (!allowed()) {
      await showMessage("Action bloquee", deniedMessage);
      return;
    }
    action();
  });
});

els.adminPeopleTools.addEventListener("click", async (event) => {
  const statPerson = event.target.closest("[data-stat-person-id]");
  if (statPerson) {
    selectPersonFromGenealogy(statPerson.dataset.statGenealogyId, statPerson.dataset.statPersonId);
    return;
  }

  const changePassword = event.target.closest("[data-admin-change-password]");
  if (changePassword) {
    await changeRegionalAdminPassword(changePassword.dataset.adminChangePassword);
    return;
  }

  const showChanges = event.target.closest("[data-admin-show-changes]");
  if (showChanges) {
    await showAdminRecentChanges(currentAdminSessionSnapshot());
    return;
  }

  const returnRegion = event.target.closest("[data-admin-return-region]");
  if (returnRegion) {
    switchGenealogy(state.adminRegionId, true);
    return;
  }

  const addRole = event.target.closest("[data-admin-add-role]");
  if (addRole) {
    addRegionalRole();
    return;
  }

  const renameRole = event.target.closest("[data-admin-rename-role]");
  if (renameRole) {
    await renameRegionalRole(renameRole.dataset.adminRenameRole);
    return;
  }

  const deleteRole = event.target.closest("[data-admin-delete-role]");
  if (deleteRole) {
    await deleteRegionalRole(deleteRole.dataset.adminDeleteRole);
    return;
  }

  const selectAll = event.target.closest("[data-admin-select-all]");
  if (selectAll) {
    toggleAdminSelection(selectAll.checked);
    return;
  }

  const deleteSelected = event.target.closest("[data-admin-delete-selected]");
  if (deleteSelected) {
    await deleteSelectedAdminPeople();
    return;
  }

  const transferSelected = event.target.closest("[data-admin-transfer-selected]");
  if (transferSelected) {
    const targetId = els.adminPeopleTools.querySelector("[data-admin-bulk-transfer-target]")?.value || "";
    await transferSelectedAdminPeople(targetId);
    return;
  }

  const deleteId = event.target.closest("[data-admin-delete-person]")?.dataset.adminDeletePerson;
  if (deleteId) {
    await deletePersonById(deleteId, true);
    return;
  }
});

els.adminPeopleTools.addEventListener("change", async (event) => {
  const cooptageRole = event.target.closest("[data-admin-cooptage-role]");
  if (cooptageRole) {
    setRegionalCooptageRole(cooptageRole.value);
    return;
  }

  const selectedPerson = event.target.closest("[data-admin-select-person]");
  if (selectedPerson) {
    setAdminPersonSelected(selectedPerson.value, selectedPerson.checked);
    return;
  }

  const quickTransfer = event.target.closest("[data-admin-transfer-target]");
  if (quickTransfer?.dataset.adminTransferPerson) {
    const transferred = await transferPersonToGenealogy(quickTransfer.dataset.adminTransferPerson, quickTransfer.value);
    if (!transferred) renderAdminTools();
  }
});

render();
restoreFormDraftIfAvailable();
loadRemoteGenealogy();
window.addEventListener("focus", () => {
  if (shouldProtectPersonFormFromRemoteRefresh()) return;
  loadRemoteGenealogy(false);
});

async function loadRemoteGenealogy(shouldUseInitialFocus = true) {
  if (!canUseRemoteApi()) {
    setServerStatus("offline");
    return;
  }
  const formRevision = state.formEditRevision;
  if (!shouldUseInitialFocus && shouldProtectPersonFormFromRemoteRefresh()) return;

  try {
    setServerStatus("saving");
    const response = await fetchGenealogyRequest(csrfFetch);
    if (!response.ok) {
      setServerStatus("error");
      return;
    }

    const payload = await response.json();
    if (shouldProtectPersonFormFromRemoteRefresh(formRevision)) {
      setServerStatus("saved");
      return;
    }
    const remoteState = applyRemoteGenealogyPayload(payload, shouldUseInitialFocus);
    state.remoteReady = true;
    if (!remoteState) {
      setServerStatus("saved");
      return;
    }
    if (!shouldProtectPersonFormFromRemoteRefresh(formRevision)) resetFormDraft();
    persistLocal();
    if (remoteState.rolesWereReset || remoteState.privateFieldsWereStripped || remoteState.personPhotosWereStripped) {
      await saveRemoteGenealogy();
    }
    setServerStatus("saved");
    render();
  } catch {
    state.remoteReady = false;
    setServerStatus("error");
  }
}

function shouldProtectPersonFormFromRemoteRefresh(startRevision = null) {
  if (startRevision !== null && state.formEditRevision !== startRevision) return true;
  return state.formDirty;
}

function applyRemoteGenealogyPayload(payload, shouldUseInitialFocus = false) {
  const hasRemoteGenealogies = Array.isArray(payload?.genealogies) && payload.genealogies.length > 0;
  const hasRemotePeople = Array.isArray(payload?.people) && payload.people.length > 0;
  if (!hasRemoteGenealogies && !hasRemotePeople) return null;

  const previousSelectedId = state.selectedId;
  const previousActiveId = state.activeGenealogyId;
  const remoteState = normaliseGenealogyState(
    hasRemoteGenealogies
      ? {
          roleResetVersion: payload.roleResetVersion,
          activeGenealogyId: payload.activeGenealogyId,
          genealogies: payload.genealogies,
          upcomingBaptisms: payload.upcomingBaptisms,
        }
      : { roleResetVersion: payload.roleResetVersion, people: payload.people || [], upcomingBaptisms: payload.upcomingBaptisms }
  );

  state.genealogies = remoteState.genealogies;
  state.upcomingBaptisms = remoteState.upcomingBaptisms;
  state.activeGenealogyId = remoteState.activeGenealogyId;
  state.people = activeGenealogy().people;
  if (shouldUseInitialFocus && !state.userSelectedGenealogy) {
    setInitialSiteFocus();
  } else if (state.genealogies.some((genealogy) => genealogy.id === previousActiveId)) {
    state.activeGenealogyId = previousActiveId;
    state.people = activeGenealogy().people;
    state.selectedId = state.people.some((person) => person.id === previousSelectedId) ? previousSelectedId : preferredSelectedPersonId();
  } else {
    state.selectedId = preferredSelectedPersonId();
  }
  return remoteState;
}

async function exportFocusedPdf() {
  if (!state.people.length) {
    await showMessage("Export impossible", "Aucune genealogie a exporter.");
    return;
  }

  const defaultName = getPerson(state.selectedId)?.name || state.people[0].name;
  const name = await askText("Exporter en PDF", "Exporter la genealogie centree sur quelle personne ?", {
    label: "Personne centree",
    value: defaultName,
    required: true,
  });
  if (name === null) return;

  const focus =
    state.people.find((person) => displayName(person).toLowerCase().includes(name.trim().toLowerCase())) ||
    getPerson(state.selectedId) ||
    state.people[0];
  const ancestorInput = await askText("Ascendants", "Combien de generations ascendantes inclure dans le PDF ?", {
    label: "Nombre de generations",
    value: String(state.ancestorDepth),
    required: true,
  });
  if (ancestorInput === null) return;
  const descendantInput = await askText("Descendants", "Combien de generations descendantes inclure dans le PDF ?", {
    label: "Nombre de generations",
    value: String(state.descendantDepth),
    required: true,
  });
  if (descendantInput === null) return;
  const ancestorDepth = readDepth(ancestorInput);
  const descendantDepth = readDepth(descendantInput);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    await showMessage("Pop-up bloquee", "Autorise l'ouverture de fenetres pour exporter le PDF.");
    return;
  }

  printWindow.document.write(renderPdfDocument(focus, ancestorDepth, descendantDepth));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function exportActiveGenealogyJson() {
  syncActiveGenealogy();
  const current = activeGenealogy();
  downloadJson(`${makeId(current.name)}.json`, {
    format: "faluche-genealogy-export",
    version: 2,
    roleResetVersion,
    scope: "active",
    groupName: defaultGenealogyName,
    exportedAt: todayIso(),
    activeGenealogyId: current.id,
    genealogies: publicGenealogies([current]),
    genealogy: publicGenealogies([current])[0],
    people: current.people,
    upcomingBaptisms: state.upcomingBaptisms.filter((event) => event.regionId === (roleRegionForGenealogy(current)?.id || current.id)),
  });
}

function exportAllGenealogyJson() {
  syncActiveGenealogy();
  downloadJson(`${makeId(defaultGenealogyName)}-complet.json`, {
    format: "faluche-genealogy-export",
    version: 2,
    roleResetVersion,
    scope: "all",
    groupName: defaultGenealogyName,
    exportedAt: todayIso(),
    activeGenealogyId: state.activeGenealogyId,
    genealogies: publicGenealogies(state.genealogies),
    upcomingBaptisms: state.upcomingBaptisms,
  });
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderPdfDocument(focus, ancestorDepth, descendantDepth) {
  const exportAncestorDepth = readDepth(ancestorDepth);
  const exportDescendantDepth = readDepth(descendantDepth);
  const network = printableNetworkModel(focus, exportAncestorDepth, exportDescendantDepth);
  return `<!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Reseau - ${escapeHtml(displayName(focus))}</title>
        <style>
          * { box-sizing: border-box; }
          body { width: 1080px; max-width: 100%; font-family: Arial, sans-serif; color: #17201b; margin: 18px auto; padding: 0 16px; }
          h1, p { margin: 0; }
          h1 { font-size: 24px; }
          .subtitle { color: #65716a; margin: 6px 0 12px; }
          .legend { display: flex; gap: 14px; flex-wrap: wrap; color: #65716a; font-size: 11px; margin: 0 0 14px; }
          .legend i { width: 26px; display: inline-block; position: relative; vertical-align: middle; margin-right: 5px; border-top: 2px solid rgba(30, 152, 163, 0.7); }
          .legend i::after { content: ""; position: absolute; right: -2px; top: -5px; width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 7px solid rgba(30, 152, 163, 0.78); }
          .legend .heart { border-top-color: rgba(189, 79, 93, 0.7); border-top-width: 3px; }
          .legend .heart::after { border-left-color: rgba(189, 79, 93, 0.82); }
          .legend .adoption { border-top-color: #7c5cff; border-top-width: 3px; }
          .legend .adoption::after { border-left-color: #7c5cff; }
          .legend .confirmation { border-top-color: #2fa36b; border-top-style: dashed; border-top-width: 3px; }
          .legend .confirmation::after { border-left-color: #2fa36b; }
          .legend .cross { border-top-color: rgba(180, 122, 22, 0.75); border-top-style: dashed; }
          .legend .cross::after { display: none; }
          .network-svg { display: block; width: 100%; height: auto; border: 1px solid #d9dfda; border-radius: 8px; background: #fbfcf8; overflow: visible; }
          .pdf-edge { stroke: rgba(30, 152, 163, 0.62); stroke-width: 2; }
          .pdf-edge-heart { stroke: rgba(189, 79, 93, 0.72); stroke-width: 3; }
          .pdf-edge-adoption { stroke: #7c5cff; stroke-width: 3; }
          .pdf-edge-confirmation { stroke: #2fa36b; stroke-width: 3; stroke-dasharray: 8 4; }
          .pdf-edge-cross { stroke: rgba(180, 122, 22, 0.78); stroke-width: 2; stroke-dasharray: 7 5; }
          .pdf-card-body { fill: #fff; stroke: #d9dfda; stroke-width: 1; }
          .pdf-card-focus .pdf-card-body { stroke: #1e98a3; stroke-width: 2; }
          .pdf-card-name { fill: #17201b; font-size: 12px; font-weight: 700; }
          .pdf-card-meta { fill: #65716a; font-size: 11px; }
          @page { size: A4 landscape; margin: 10mm; }
          @media print {
            body { width: auto; margin: 0; padding: 0; }
            .network-svg { max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <h1>Reseau centre sur ${escapeHtml(displayName(focus))}</h1>
        <p class="subtitle">${exportAncestorDepth} generation(s) ascendante(s), ${exportDescendantDepth} generation(s) descendante(s)</p>
        <div class="legend">
          <span><i></i>Parrain</span>
          <span><i class="heart"></i>Parrain de coeur</span>
          <span><i class="adoption"></i>Parrain d'adoption</span>
          <span><i class="confirmation"></i>Parrain de confirmation</span>
          <span><i class="cross"></i>Bapteme croise</span>
        </div>
        ${printableNetworkSvg(network)}
      </body>
    </html>`;
}

function printableNetworkModel(focus, ancestorDepth, descendantDepth) {
  return networkLayout(focus, ancestorDepth, descendantDepth);
}

function networkLayout(focus, ancestorDepth = state.ancestorDepth, descendantDepth = state.descendantDepth) {
  const rings = graphRings(focus, ancestorDepth, descendantDepth);
  const maxCount = Math.max(...rings.map((ring) => ring.people.length), 1);
  const width = Math.max(720, maxCount * 190);
  const rowGap = 130;
  const positions = new Map();

  rings.forEach((ring, ringIndex) => {
    const gap = width / (ring.people.length + 1);
    ring.people.forEach((item, index) => {
      positions.set(item.id, { x: gap * (index + 1), y: 30 + ringIndex * rowGap });
    });
  });

  const height = Math.max(620, rings.length * rowGap + 90);
  return { focus, rings, positions, width, height };
}

function printableNetworkSvg(network) {
  const stripDefs = svgStripDefs(network);
  const arrowDefs = `<marker id="pdf-arrow-sponsor" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(30, 152, 163, 0.72)" /></marker><marker id="pdf-arrow-heart" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(189, 79, 93, 0.82)" /></marker><marker id="pdf-arrow-adoption" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7c5cff" /></marker><marker id="pdf-arrow-confirmation" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2fa36b" /></marker>`;
  const edges = [];
  network.positions.forEach((position, id) => {
    const current = graphPerson(id);
    if (!current) return;
    lineageSponsorLinks(current).forEach((link) => {
      if (network.positions.has(link.id)) edges.push(edgeSvg(network.positions.get(link.id), position, link.kind));
    });
  });

  state.people.forEach((current) => {
    if (!current.crossGroupId || !network.positions.has(current.id)) return;
    getCrossGroupMembers(current.id).forEach((member) => {
      if (member.id <= current.id || !network.positions.has(member.id)) return;
      edges.push(edgeSvg(network.positions.get(current.id), network.positions.get(member.id), "cross"));
    });
  });

  const nodes = [...network.positions.entries()]
    .map(([id, position]) => {
      const person = graphPerson(id);
      return person ? printableNetworkNodeSvg(person, id === network.focus.id, position, stripDefs.fills) : "";
    })
    .join("");

  return `<svg class="network-svg" viewBox="0 0 ${network.width} ${network.height}" role="img" aria-label="Reseau centre sur ${escapeHtml(displayName(network.focus))}" preserveAspectRatio="xMidYMin meet">
    <defs>${arrowDefs}${stripDefs.defs}</defs>
    <g>${edges.join("")}</g>
    <g>${nodes}</g>
  </svg>`;
}

function edgeSvg(from, to, kind = "sponsor") {
  const geometry = edgeGeometry(from, to, {
    hasArrow: kind !== "cross",
    nodeHeight: 96,
  });
  const className =
    kind === "heart"
      ? "pdf-edge pdf-edge-heart"
      : kind === "cross"
        ? "pdf-edge pdf-edge-cross"
        : kind === "adoption"
          ? "pdf-edge pdf-edge-adoption"
          : kind === "confirmation"
            ? "pdf-edge pdf-edge-confirmation"
            : "pdf-edge";
  const marker =
    kind === "heart"
      ? ` marker-end="url(#pdf-arrow-heart)"`
      : kind === "cross"
        ? ""
        : kind === "adoption"
          ? ` marker-end="url(#pdf-arrow-adoption)"`
          : kind === "confirmation"
            ? ` marker-end="url(#pdf-arrow-confirmation)"`
            : ` marker-end="url(#pdf-arrow-sponsor)"`;
  return `<line class="${className}" x1="${geometry.x1}" y1="${geometry.y1}" x2="${geometry.x2}" y2="${geometry.y2}"${marker} />`;
}

function printableNetworkNodeSvg(person, focus, position, stripFills) {
  const width = 154;
  const height = 96;
  const x = Number((position.x - width / 2).toFixed(1));
  const y = Number(position.y.toFixed(1));
  const textX = x + 14;
  const stripFill = stripFills.get(person.id) || "#d9dfda";
  const lines = [
    ...wrappedLines(displayName(person), 22, 2).map((text) => ({ text, className: "pdf-card-name" })),
    ...wrappedLines(filiereLabel(person.filiere), 24, 1).map((text) => ({ text, className: "pdf-card-meta" })),
    ...wrappedLines(compactLine(person), 24, 1).map((text) => ({ text, className: "pdf-card-meta" })),
    ...wrappedLines(formatCeremonyDate(person, true), 24, 1).map((text) => ({ text, className: "pdf-card-meta" })),
  ].slice(0, 6);
  const text = lines
    .map((line, index) => `<text class="${line.className}" x="${textX}" y="${y + 21 + index * 13}">${escapeHtml(line.text)}</text>`)
    .join("");

  return `<g class="pdf-card${focus ? " pdf-card-focus" : ""}">
    <rect class="pdf-card-body" x="${x}" y="${y}" width="${width}" height="${height}" rx="8" />
    <rect x="${x}" y="${y}" width="7" height="${height}" rx="4" fill="${stripFill}" />
    ${text}
  </g>`;
}

function svgStripDefs(network) {
  const gradients = new Map();
  const fills = new Map();
  const defs = [];

  network.positions.forEach((position, id) => {
    const person = graphPerson(id);
    if (!person) return;
    const strip = filiereStrip(person.filiere);
    if (!strip) {
      fills.set(id, "#d9dfda");
      return;
    }
    if (!strip.startsWith("linear-gradient")) {
      fills.set(id, escapeHtml(strip));
      return;
    }
    if (!gradients.has(strip)) {
      const gradientId = `pdf-strip-${gradients.size + 1}`;
      gradients.set(strip, gradientId);
      defs.push(`<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">${svgGradientStops(strip)}</linearGradient>`);
    }
    fills.set(id, `url(#${gradients.get(strip)})`);
  });

  return { defs: defs.join(""), fills };
}

function svgGradientStops(gradient) {
  const content = gradient.slice(gradient.indexOf(",") + 1, gradient.lastIndexOf(")"));
  const parts = content.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return `<stop offset="0%" stop-color="#d9dfda" /><stop offset="100%" stop-color="#d9dfda" />`;

  return parts
    .flatMap((part, index) => {
      const color = part.match(/#[0-9a-fA-F]{3,8}/)?.[0] || "#d9dfda";
      const offsets = [...part.matchAll(/(\d+(?:\.\d+)?)%/g)].map((match) => `${match[1]}%`);
      const fallbackOffset = parts.length === 1 ? "0%" : `${Math.round((index / (parts.length - 1)) * 100)}%`;
      const stops = offsets.length ? offsets : [fallbackOffset];
      return stops.map((offset) => `<stop offset="${offset}" stop-color="${escapeHtml(color)}" />`);
    })
    .join("");
}

function saveRecentPersonIds() {
  saveStoredRecentPersonIds(state.recentPersonIds);
}

function normaliseRecentPersonEntries(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input
    .map((item) => {
      const personId = typeof item === "string" ? item : String(item?.personId || "");
      const genealogyId = typeof item === "string" ? "" : String(item?.genealogyId || "");
      return { genealogyId, personId };
    })
    .filter((item) => item.personId)
    .filter((item) => {
      const key = `${item.genealogyId}:${item.personId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function normaliseGenealogyState(input) {
  const fallback = { id: mainGenealogyId, name: defaultGenealogyName, type: "national", parentId: "", photoData: "", people: [], customRoles: [] };
  const hasStoredCustomRoles =
    Array.isArray(input?.genealogies) &&
    input.genealogies.some((item) => normaliseRoleOptions(item?.customRoles || item?.roleOptions).length > 0);
  const roleVersionNeedsSave = input?.roleResetVersion !== roleResetVersion;
  const shouldResetExistingRoles = roleVersionNeedsSave && !hasStoredCustomRoles;
  let rawGenealogies = Array.isArray(input?.genealogies)
    ? input.genealogies
    : Array.isArray(input?.people)
      ? [{ ...fallback, name: input.name || input.groupName || fallback.name, people: input.people }]
    : Array.isArray(input)
      ? [{ ...fallback, people: input }]
      : [];

  if (shouldMigrateLegacyGenealogies(rawGenealogies)) {
    rawGenealogies = migrateLegacyGenealogies(rawGenealogies);
  }

  const privateFieldsWereStripped = rawGenealogies.some((item) => String(item?.adminPassword || "").trim() !== "");
  const personPhotosWereStripped = rawGenealogies.some(genealogyHasPersonPhotos);
  const seen = new Set();
  const genealogies = rawGenealogies
    .map((item, index) => {
      const rawName = String(item?.name || (index === 0 ? defaultGenealogyName : `Genealogie ${index + 1}`)).trim();
      const name = index === 0 && rawName === oldDefaultGenealogyName ? defaultRegionalGenealogyName : rawName;
      const id = String(item?.id || makeId(name || `genealogie-${index + 1}`)).trim();
      const type = normaliseGenealogyType(item?.type || item?.level || item?.scope, id, name);
      return {
        id: uniqueGenealogyIdFrom(id, seen),
        name: name || `Genealogie ${index + 1}`,
        type,
        parentId: type === "national" ? "" : String(item?.parentId || item?.regionId || "").trim(),
        photoData: normaliseImageData(item?.photoData),
        people: normalisePeople(item?.people, { normaliseFiliere, maxCrossGroupSize }),
        customRoles: shouldResetExistingRoles ? [] : normaliseRoleOptions(item?.customRoles || item?.roleOptions),
        cooptageRoleId: type === "region" ? normaliseRoleId(item?.cooptageRoleId) || defaultCooptageRoleId : "",
        adminPassword: "",
      };
    })
    .filter((item) => item.id && item.name);

  if (!genealogies.length) genealogies.push(fallback);
  const syncedGenealogies = shouldResetExistingRoles
    ? clearAllRoles(withMainGenealogyPeople(genealogies))
    : stripLegacyDefaultRoles(withMainGenealogyPeople(genealogies));
  const activeGenealogyId = syncedGenealogies.some((item) => item.id === input?.activeGenealogyId)
    ? input.activeGenealogyId
    : syncedGenealogies[0].id;
  return {
    genealogies: syncedGenealogies,
    activeGenealogyId,
    upcomingBaptisms: normaliseUpcomingBaptisms(input?.upcomingBaptisms),
    rolesWereReset: roleVersionNeedsSave,
    privateFieldsWereStripped,
    personPhotosWereStripped,
  };
}

function genealogyHasPersonPhotos(genealogy) {
  return Array.isArray(genealogy?.people) && genealogy.people.some((person) => normaliseImageData(person?.photoData));
}

function clearAllRoles(genealogies) {
  return genealogies.map((genealogy) => ({
    ...genealogy,
    customRoles: [],
    people: genealogy.people.map((person) => ({ ...person, roles: [] })),
  }));
}

function stripLegacyDefaultRoles(genealogies) {
  const regionalRoleIds = new Map(
    genealogies
      .filter(isRegionalGenealogy)
      .map((region) => [region.id, new Set(normaliseRoleOptions(region.customRoles).map((role) => role.id))])
  );
  const allRegionalRoleIds = new Set([...regionalRoleIds.values()].flatMap((ids) => [...ids]));

  return genealogies.map((genealogy) => {
    const allowedLegacyRoles = isMainGenealogy(genealogy)
      ? allRegionalRoleIds
      : isRegionalGenealogy(genealogy)
        ? regionalRoleIds.get(genealogy.id) || new Set()
        : regionalRoleIds.get(genealogy.parentId) || new Set();
    return {
      ...genealogy,
      people: genealogy.people.map((person) => ({
        ...person,
        roles: normaliseRoles(person.roles).filter((role) => !legacyDefaultRoleIds.has(role) || allowedLegacyRoles.has(role)),
      })),
    };
  });
}

function shouldMigrateLegacyGenealogies(rawGenealogies) {
  if (!Array.isArray(rawGenealogies) || rawGenealogies.length === 0) return false;
  const hasHierarchy = rawGenealogies.some((item) => item?.type || item?.level || item?.scope || item?.parentId || item?.regionId);
  if (hasHierarchy) return false;
  return rawGenealogies.some(isMainGenealogyRaw);
}

function migrateLegacyGenealogies(rawGenealogies) {
  const legacyMain = rawGenealogies.find(isMainGenealogyRaw) || rawGenealogies[0];
  const familyGenealogies = rawGenealogies.filter((item) => item !== legacyMain);
  return [
    { id: mainGenealogyId, name: defaultGenealogyName, type: "national", parentId: "", photoData: "", people: [] },
    {
      ...legacyMain,
      id: defaultRegionalGenealogyId,
      name: defaultRegionalGenealogyName,
      type: "region",
      parentId: mainGenealogyId,
    },
    ...familyGenealogies.map((item) => ({
      ...item,
      type: "family",
      parentId: defaultRegionalGenealogyId,
    })),
  ];
}

function withMainGenealogyPeople(genealogies) {
  const orderedGenealogies = ensureMainGenealogy(genealogies);
  const national = orderedGenealogies.find(isMainGenealogy) || orderedGenealogies[0];
  const families = orderedGenealogies.filter(isFamilyGenealogy);
  const regions = orderedGenealogies.filter(isRegionalGenealogy).map((region) => {
    const childFamilies = families.filter((family) => family.parentId === region.id);
    return {
      ...region,
      people: aggregateMainGenealogyPeople(region.people, childFamilies, region),
    };
  });
  const nonNationalGenealogies = [...regions, ...families];
  const syncedNational = {
    ...national,
    id: mainGenealogyId,
    name: defaultGenealogyName,
    type: "national",
    parentId: "",
    people: aggregateMainGenealogyPeople(national.people, nonNationalGenealogies, national),
    customRoles: [],
    adminPassword: "",
  };
  return [syncedNational, ...regions, ...families];
}

function ensureMainGenealogy(genealogies) {
  const cleaned = genealogies.map((genealogy, index) => {
    const type = normaliseGenealogyType(genealogy.type, genealogy.id, genealogy.name);
    return {
      ...genealogy,
      type,
      parentId: type === "national" ? "" : String(genealogy.parentId || "").trim(),
      customRoles: normaliseRoleOptions(genealogy.customRoles),
      cooptageRoleId: type === "region" ? normaliseRoleId(genealogy.cooptageRoleId) || defaultCooptageRoleId : "",
      adminPassword: "",
      people: normalisePeople(genealogy.people, { normaliseFiliere, maxCrossGroupSize }),
    };
  });
  const nationalGenealogies = cleaned.filter(isMainGenealogy);
  const national = nationalGenealogies.length
    ? {
        ...nationalGenealogies[0],
        id: mainGenealogyId,
        name: defaultGenealogyName,
        type: "national",
        parentId: "",
        people: normalisePeople(nationalGenealogies.flatMap((genealogy) => genealogy.people), { normaliseFiliere, maxCrossGroupSize }),
        customRoles: [],
        adminPassword: "",
      }
    : { id: mainGenealogyId, name: defaultGenealogyName, type: "national", parentId: "", photoData: "", people: [], customRoles: [], adminPassword: "" };

  let rest = cleaned.filter((genealogy) => !isMainGenealogy(genealogy));
  let regions = rest.filter(isRegionalGenealogy).map((region) => ({ ...region, parentId: mainGenealogyId }));
  let families = rest.filter((genealogy) => !isRegionalGenealogy(genealogy)).map((genealogy) => ({
    ...genealogy,
    type: "family",
  }));

  if (!regions.length && families.length) {
    regions = [
      {
        id: defaultRegionalGenealogyId,
        name: defaultRegionalGenealogyName,
        type: "region",
        parentId: mainGenealogyId,
        photoData: "",
        people: [],
        customRoles: [],
        cooptageRoleId: defaultCooptageRoleId,
        adminPassword: "",
      },
    ];
  }

  const regionIds = new Set(regions.map((region) => region.id));
  const fallbackRegionId = regions[0]?.id || "";
  families = families.map((family) => ({
    ...family,
    parentId: regionIds.has(family.parentId) ? family.parentId : fallbackRegionId,
  }));

  return [national, ...regions, ...families];
}

function aggregateMainGenealogyPeople(mainPeople, otherGenealogies, mainGenealogy = { id: mainGenealogyId, name: defaultGenealogyName, people: mainPeople }) {
  const byPerson = new Map();
  const entriesByKey = new Map();
  const entries = [];
  otherGenealogies.forEach((genealogy) => {
    genealogy.people.forEach((person) => {
      const entry = { person, genealogy };
      entries.push(entry);
      const key = statPersonKey(person);
      if (!entriesByKey.has(key)) entriesByKey.set(key, []);
      entriesByKey.get(key).push(entry);
      const current = byPerson.get(key);
      if (!current || compareStatSource(entry, current) < 0) {
        byPerson.set(key, entry);
      }
    });
  });

  mainPeople.forEach((person) => {
    const entry = { person, genealogy: { ...mainGenealogy, people: mainPeople } };
    entries.push(entry);
    const key = statPersonKey(person);
    if (!entriesByKey.has(key)) entriesByKey.set(key, []);
    entriesByKey.get(key).push(entry);
    if (!byPerson.has(key)) {
      byPerson.set(key, entry);
    }
  });

  const selectedEntries = [...byPerson.values()];
  const usedIds = new Set();
  const canonicalIdByKey = new Map();
  selectedEntries.forEach(({ person }) => {
    const key = statPersonKey(person);
    const id = uniquePersonIdFrom(person.id, usedIds);
    usedIds.add(id);
    canonicalIdByKey.set(key, id);
  });

  const keyByScopedId = new Map();
  const keysById = new Map();
  const familyIdsByRegionId = new Map();
  entries.forEach(({ person, genealogy }) => {
    const key = statPersonKey(person);
    keyByScopedId.set(`${genealogy.id}:${person.id}`, key);
    if (!keysById.has(person.id)) keysById.set(person.id, new Set());
    keysById.get(person.id).add(key);
    if (isFamilyGenealogy(genealogy) && genealogy.parentId) {
      if (!familyIdsByRegionId.has(genealogy.parentId)) familyIdsByRegionId.set(genealogy.parentId, new Set());
      familyIdsByRegionId.get(genealogy.parentId).add(genealogy.id);
    }
  });

  const canonicalIds = new Set(canonicalIdByKey.values());
  const scopedIdsForGenealogy = (genealogy) => {
    const ids = [genealogy.id];
    if (isFamilyGenealogy(genealogy) && genealogy.parentId) ids.push(genealogy.parentId);
    if (isRegionalGenealogy(genealogy)) ids.push(...(familyIdsByRegionId.get(genealogy.id) || []));
    if (mainGenealogy?.id) ids.push(mainGenealogy.id);
    return uniqueIds(ids);
  };
  const linkedKeyFor = (linkedId, genealogy) => {
    for (const scopeId of scopedIdsForGenealogy(genealogy)) {
      const scopedKey = keyByScopedId.get(`${scopeId}:${linkedId}`);
      if (scopedKey) return scopedKey;
    }
    const globalKeys = keysById.get(linkedId);
    return globalKeys?.size === 1 ? [...globalKeys][0] : "";
  };
  const remapLinkedIds = (ids, genealogy, personId) =>
    uniqueIds(
      ids.map((linkedId) => {
        const linkedKey = linkedKeyFor(linkedId, genealogy);
        return canonicalIdByKey.get(linkedKey) || linkedId;
      })
    ).filter((linkedId) => canonicalIds.has(linkedId) && linkedId !== personId);

  const aggregateEvents = (sourceEntries, personId) => {
    const seen = new Set();
    return sourceEntries.flatMap(({ person, genealogy }) =>
      normaliseCeremonyEvents(person.ceremonyEvents)
        .map((event) => ({
          ...event,
          sponsorIds: remapLinkedIds(event.sponsorIds, genealogy, personId),
        }))
        .filter((event) => {
          const key = ceremonyEventKey(event);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
    );
  };

  return normalisePeople(
    selectedEntries.map(({ person, genealogy }) => {
      const key = statPersonKey(person);
      const id = canonicalIdByKey.get(key) || person.id;
      const sourceEntries = entriesByKey.get(key) || [{ person, genealogy }];
      return {
        ...person,
        id,
        sponsorIds: uniqueIds(sourceEntries.flatMap((entry) => remapLinkedIds(entry.person.sponsorIds, entry.genealogy, id))),
        heartSponsorIds: uniqueIds(sourceEntries.flatMap((entry) => remapLinkedIds(entry.person.heartSponsorIds, entry.genealogy, id))),
        ceremonyEvents: aggregateEvents(sourceEntries, id),
      };
    }),
    { normaliseFiliere, maxCrossGroupSize }
  ).sort(comparePeopleByFiliereAndName);
}

function isMainGenealogy(genealogy) {
  return genealogy?.type === "national" || genealogy?.id === mainGenealogyId;
}

function isMainGenealogyRaw(genealogy) {
  const name = normalisedText(genealogy?.name);
  return genealogy?.id === mainGenealogyId || genealogy?.id === "kfetteria" || mainGenealogyNameAliases.some((alias) => name === normalisedText(alias));
}

function isRegionalGenealogy(genealogy) {
  return genealogy?.type === "region";
}

function isFamilyGenealogy(genealogy) {
  return genealogy?.type === "family";
}

function isAggregateGenealogy(genealogy) {
  return isMainGenealogy(genealogy) || isRegionalGenealogy(genealogy);
}

function normaliseGenealogyType(value, id = "", name = "") {
  const type = String(value || "").toLowerCase();
  if (["national", "nationale", "root"].includes(type) || id === mainGenealogyId) return "national";
  if (["region", "regional", "regionale", "ville", "city"].includes(type)) return "region";
  if (["family", "famille"].includes(type)) return "family";
  return isMainGenealogyRaw({ id, name }) ? "national" : "family";
}

function normaliseNewGenealogyType(value) {
  const type = normalisedText(value);
  if (["region", "regional", "regionale", "ville"].includes(type)) return "region";
  if (["famille", "family"].includes(type)) return "family";
  return "";
}

function requestGenealogyPhoto(genealogyId) {
  if (!genealogyById(genealogyId)) return;
  state.pendingGenealogyPhotoId = genealogyId;
  els.genealogyPhotoInput.click();
}

function genealogyIndexFor(genealogies = state.genealogies) {
  return createGenealogyIndex(genealogies, { cache: genealogyIndexCache, isMainGenealogy, isRegionalGenealogy, isFamilyGenealogy });
}

function genealogyById(genealogyId) {
  return genealogyIndexFor().byId.get(genealogyId) || null;
}

function activePeople(genealogyState) {
  return activePeopleFromGenealogyState(genealogyState, { cache: genealogyIndexCache, isMainGenealogy, isRegionalGenealogy, isFamilyGenealogy });
}

function activeGenealogy() {
  return activeGenealogyFromState(state, { cache: genealogyIndexCache, isMainGenealogy, isRegionalGenealogy, isFamilyGenealogy });
}

function mainGenealogy() {
  return mainGenealogyFromState(state, { cache: genealogyIndexCache, isMainGenealogy, isRegionalGenealogy, isFamilyGenealogy });
}

function regionalGenealogyFor(genealogy) {
  return regionalGenealogyForState(genealogy, { genealogyById, isMainGenealogy, isRegionalGenealogy });
}

function childGenealogies(parentId) {
  return childGenealogiesFor(parentId, { genealogyIndex: genealogyIndexFor() });
}

function regionalScopeGenealogies(genealogy) {
  return regionalScopeGenealogiesFor(genealogy, { regionalGenealogyFor, childGenealogies, isRegionalGenealogy, isFamilyGenealogy });
}

function currentStatsGenealogies() {
  const active = activeGenealogy();
  const synced = state.genealogies.map((genealogy) =>
    genealogy.id === state.activeGenealogyId ? { ...genealogy, people: state.people } : genealogy
  );
  if (isMainGenealogy(active)) return synced;
  const scopeIds = new Set(regionalScopeGenealogies(active).map((genealogy) => genealogy.id));
  return synced.filter((genealogy) => scopeIds.has(genealogy.id));
}

function statsScopeLabel() {
  const active = activeGenealogy();
  if (isMainGenealogy(active)) return "Faluche Nationale";
  const region = regionalGenealogyFor(active) || active;
  return region ? region.name : active.name;
}

function isGeneralAdmin() {
  return state.adminMode && state.adminLevel === "general";
}

function isRegionalAdmin() {
  return state.adminMode && state.adminLevel === "region";
}

function adminPasswordChangeRequired() {
  return isRegionalAdmin() && state.adminRequiresPasswordChange;
}

function adminRegion() {
  return isRegionalAdmin() ? genealogyById(state.adminRegionId) : null;
}

function genealogyInAdminScope(genealogy) {
  if (!state.adminMode) return true;
  if (isGeneralAdmin()) return true;
  const region = adminRegion();
  return Boolean(region && (genealogy?.id === region.id || genealogy?.parentId === region.id));
}

function genealogyIdInAdminScope(genealogyId) {
  return genealogyInAdminScope(genealogyById(genealogyId));
}

function requireAdminForEdit() {
  if (adminPasswordChangeRequired()) {
    void showMessage("Modification bloquee", "Change ton mot de passe admin regional avant de modifier les donnees.");
    return false;
  }
  if (state.adminMode) return true;
  void showMessage("Mode admin requis", "Connecte-toi en mode admin pour modifier les donnees.");
  return false;
}

async function loginAdmin(password) {
  if (!canUseRemoteApi()) {
    await showMessage("Serveur requis", "Le mode admin securise necessite le serveur PHP.");
    return null;
  }

  try {
    const response = await loginAdminRequest(password, csrfFetch);
    if (response.status === 429) {
      await showMessage("Trop de tentatives", await readResponseMessage(response));
      return undefined;
    }
    if (!response.ok) return null;
    const payload = await response.json();
    state.csrfToken = "";
    return normaliseAdminSession(payload.admin);
  } catch {
    await showMessage("Serveur indisponible", "Impossible de joindre l'authentification admin.");
    return undefined;
  }
}

async function logoutAdmin() {
  if (!canUseRemoteApi()) return;
  try {
    await logoutAdminRequest(csrfFetch);
    state.csrfToken = "";
  } catch {
    // La session locale sera quand meme fermee.
  }
}

function applyAdminSession(session) {
  applyAdminSessionAction(state, session, normaliseAdminSession);
}

function adminRegionInfo(regionId) {
  return findAdminRegionInfo(state.adminRegions, regionId);
}

async function showAdminRecentChanges(session) {
  const changes = normaliseAdminRecentChanges(session?.recentChanges || state.adminRecentChanges);
  const scopeLabel = adminScopeLabel(session, adminRegionInfo(session?.regionId)?.name || "ta region");
  const lines = changes.length
    ? changes.map((change) => adminRecentChangeLine(change, formatDoleanceDate))
    : ["Aucune modification enregistree depuis ta derniere connexion."];
  await showMessage("Dernieres modifications", `Concernant ${scopeLabel}\n\n${lines.join("\n")}`);
}

function relationshipPeopleForGenealogy(genealogy) {
  if (!genealogy) return [];
  if (isMainGenealogy(genealogy)) return genealogy.people;
  const region = regionalGenealogyFor(genealogy);
  const mainPeople = mainGenealogy()?.people || [];
  const regionPeople = region && region.id !== genealogy.id ? region.people : [];
  return uniquePeopleById([...genealogy.people, ...regionPeople, ...mainPeople]);
}

function relatedPerson(personId) {
  return getPersonFromPeople(relationshipPeopleForGenealogy(activeGenealogy()), personId);
}

function editableSelectedPersonEntry() {
  const selected = getPerson(state.selectedId);
  if (!selected) return null;
  const active = activeGenealogy();
  if (isFamilyGenealogy(active)) return { person: selected, genealogy: active };
  return sourceEntryForAggregatePerson(selected, active) || { person: selected, genealogy: { ...active, people: state.people } };
}

function sourceEntryForAggregatePerson(person, aggregateGenealogy) {
  const key = statPersonKey(person);
  const scope = isMainGenealogy(aggregateGenealogy) ? state.genealogies : regionalScopeGenealogies(aggregateGenealogy);
  const scopeIds = new Set(scope.map((genealogy) => genealogy.id));
  return state.genealogies
    .filter((genealogy) => scopeIds.has(genealogy.id))
    .flatMap((genealogy) => {
      const people = genealogy.id === state.activeGenealogyId ? state.people : genealogy.people;
      return people
        .filter((candidate) => candidate.id === person.id || statPersonKey(candidate) === key)
        .map((candidate) => ({ person: candidate, genealogy: { ...genealogy, people } }));
    })
    .sort(compareStatSource)[0] || null;
}

function preferredSelectedPersonId() {
  const current = activeGenealogy();
  if (!current?.people.length) return null;
  return mostConnectedPerson(current.people)?.id ?? current.people[0]?.id ?? null;
}

function setInitialSiteFocus() {
  const main = mainGenealogy();
  if (main) {
    state.activeGenealogyId = main.id;
    state.people = main.people;
    state.formTargetGenealogyId = main.id;
  }
  state.selectedId = preferredSelectedPersonId();
}

function setupDeviceMode() {
  let wasSmartphone = null;
  const update = () => {
    const isSmartphone = isSmartphoneViewport();
    document.body.classList.toggle("is-smartphone", isSmartphone);
    if (isSmartphone && wasSmartphone !== true) closePersonFormSections();
    if (!isSmartphone) state.showEditor = true;
    if (wasSmartphone !== null && wasSmartphone !== isSmartphone) {
      closeGenealogyMenu();
      renderLayoutOptions();
    }
    wasSmartphone = isSmartphone;
  };
  update();
  watchDeviceQuery("(max-width: 740px)", update);
  watchDeviceQuery("(hover: none) and (pointer: coarse) and (max-width: 960px)", update);
  window.visualViewport?.addEventListener?.("resize", update);
  window.addEventListener("orientationchange", () => {
    closeGenealogyMenu();
    update();
  });
}

function watchDeviceQuery(query, listener) {
  const media = window.matchMedia?.(query);
  if (!media) return;
  if (media.addEventListener) {
    media.addEventListener("change", listener);
    return;
  }
  media.addListener?.(listener);
}

function isSmartphoneViewport() {
  const narrow = window.matchMedia?.("(max-width: 740px)")?.matches ?? window.innerWidth <= 740;
  const coarseSmall =
    window.matchMedia?.("(hover: none) and (pointer: coarse) and (max-width: 960px)")?.matches ?? false;
  return narrow || coarseSmall;
}

function closeGenealogyMenu() {
  if (els.genealogyMenu) els.genealogyMenu.open = false;
}

function closePersonFormSections() {
  document.querySelectorAll(".person-form .form-section").forEach((section) => {
    section.open = false;
  });
}

function openFormStep(targetId) {
  if (targetId === "quick") {
    closePersonFormSections();
    els.personForm.querySelector(".quick-fields")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const section = document.getElementById(targetId);
  if (!section) return;
  closePersonFormSections();
  section.open = true;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitGraphViewport() {
  const target = document.querySelector(".toolbar") || document.body;
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToPersonForm() {
  if (!els.personForm) return;
  window.requestAnimationFrame(() => {
    els.personForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setViewMode(mode) {
  setViewModeAction(state, mode);
  render();
}

function updateGraphZoom(delta, shouldReset = false) {
  updateGraphZoomAction(state, delta, { shouldReset });
  renderGraph();
}

function resetScopeSelection(shouldClearSearch = true) {
  state.formTargetGenealogyId = state.activeGenealogyId;
  state.selectedId = preferredSelectedPersonId();
  state.adminSelectedPersonIds = [];
  if (shouldClearSearch) clearSearch();
  resetFormDraft();
}

function clearSearch() {
  state.query = "";
  els.searchInput.value = "";
}

function rememberRecentPerson(genealogyId, personId) {
  if (!personId) return;
  const entry = personEntryForRecent(genealogyId, personId);
  if (!entry) return;
  const key = `${entry.genealogyId}:${entry.personId}`;
  state.recentPersonIds = [
    entry,
    ...state.recentPersonIds.filter((item) => `${item.genealogyId}:${item.personId}` !== key),
  ].slice(0, 8);
  saveRecentPersonIds();
}

function personEntryForRecent(genealogyId, personId) {
  const preferred = genealogyById(genealogyId);
  if (preferred && getPersonFromPeople(preferred.people, personId)) {
    return { genealogyId: preferred.id, personId };
  }
  const fallback = state.genealogies.find((genealogy) => getPersonFromPeople(genealogy.people, personId));
  return fallback ? { genealogyId: fallback.id, personId } : null;
}

function recentPersonEntries() {
  return state.recentPersonIds
    .map((item) => {
      const genealogy = genealogyById(item.genealogyId) || state.genealogies.find((candidate) => getPersonFromPeople(candidate.people, item.personId));
      const person = genealogy ? getPersonFromPeople(genealogy.people, item.personId) : null;
      return person && genealogy ? { person, genealogy } : null;
    })
    .filter(Boolean);
}

function currentAdminSessionSnapshot() {
  return {
    authenticated: state.adminMode,
    level: state.adminLevel,
    regionId: state.adminRegionId,
    recentChanges: state.adminRecentChanges,
  };
}

function setServerStatus(status, message = "") {
  state.serverStatus = status;
  if (!els.serverStatus) return;
  els.serverStatus.textContent = message || labelFromMap(uiLabels.serverStatus, status, uiLabels.serverStatus.offline);
  els.serverStatus.className = `server-status is-${status}`;
}

function mostConnectedPerson(people) {
  return [...people]
    .map((person) => {
      const ancestors = uniquePeopleByStatIdentity(flattenGroups(getAncestorsByDepthFromPeople(people, person.id))).length;
      const descendants = uniquePeopleByStatIdentity(flattenGroups(getDescendantsByDepthFromPeople(people, person.id))).length;
      return { person, ancestors, descendants, balancedScore: Math.min(ancestors, descendants), score: ancestors + descendants };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.balancedScore - a.balancedScore ||
        b.descendants - a.descendants ||
        b.ancestors - a.ancestors ||
        displayName(a.person).localeCompare(displayName(b.person), "fr")
    )[0]?.person;
}

function syncActiveGenealogy() {
  const activeWasAggregate = isAggregateGenealogy(activeGenealogy());
  state.genealogies = state.genealogies.map((item) =>
    item.id === state.activeGenealogyId ? { ...item, people: state.people } : item
  );
  state.genealogies = withMainGenealogyPeople(state.genealogies);
  if (activeWasAggregate) state.people = activeGenealogy().people;
}

function switchGenealogy(id, shouldPersist = true) {
  if (!state.genealogies.some((item) => item.id === id)) return;
  if (state.adminMode && !genealogyIdInAdminScope(id)) {
    void showMessage("Action bloquee", "Cet admin regional ne peut modifier que sa region et ses familles.");
    return;
  }
  syncActiveGenealogy();
  state.activeGenealogyId = id;
  state.people = activeGenealogy().people;
  resetScopeSelection();
  if (shouldPersist) persist();
  render();
}

function selectPersonFromGenealogy(genealogyId, personId) {
  if (genealogyId && genealogyId !== state.activeGenealogyId) {
    state.userSelectedGenealogy = true;
    switchGenealogy(genealogyId, false);
  }
  if (!getPerson(personId)) return;

  state.selectedId = personId;
  state.mode = "tree";
  clearSearch();
  resetFormDraft();
  rememberRecentPerson(state.activeGenealogyId, personId);
  persistLocal();
  render();
}

function selectRelatedPerson(personId) {
  if (getPerson(personId)) {
    state.selectedId = personId;
    resetFormDraft();
    rememberRecentPerson(state.activeGenealogyId, personId);
    render();
    return;
  }

  const main = mainGenealogy();
  if (main && getPersonFromPeople(main.people, personId)) {
    selectPersonFromGenealogy(main.id, personId);
  }
}

function genealogiesForGlobalStats() {
  return currentStatsGenealogies();
}

function readImageFile(file) {
  if (!allowedImageMimeTypes.has(file.type)) return Promise.reject(new Error("Image invalide"));
  if (file.size > maxImageUploadBytes) return Promise.reject(new Error("Image trop volumineuse"));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const imageData = normaliseImageData(reader.result);
      if (!imageData) {
        reject(new Error("Image invalide"));
        return;
      }
      resolve(imageData);
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function normaliseImageData(value) {
  const imageData = String(value || "");
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(imageData)) return "";
  const encoded = imageData.slice(imageData.indexOf(",") + 1).replace(/\s/g, "");
  const approximateBytes = Math.floor((encoded.length * 3) / 4);
  return approximateBytes <= maxImageUploadBytes ? imageData : "";
}

function readTextFile(file) {
  if (file.size > maxJsonImportBytes) return Promise.reject(new Error("Fichier trop volumineux"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

async function readPeopleJsonFile(file) {
  const payload = await readJsonFile(file);

  const rawPeople = peoplePayloadForActiveImport(payload);
  if (!Array.isArray(rawPeople)) {
    throw new Error('Le JSON doit contenir une liste de personnes, une propriete "people", ou des genealogies.');
  }

  const people = normalisePeople(rawPeople, { normaliseFiliere, maxCrossGroupSize });
  return payload?.roleResetVersion === roleResetVersion ? people : people.map((person) => ({ ...person, roles: [] }));
}

async function readGenealogyJsonFile(file) {
  const payload = await readJsonFile(file);
  return normaliseGenealogyState(genealogyPayloadForFullImport(payload));
}

async function readJsonFile(file) {
  const fileName = String(file?.name || "").toLowerCase();
  const fileType = String(file?.type || "");
  if (fileName && !fileName.endsWith(".json") && fileType !== "application/json") {
    throw new Error("Choisis un fichier JSON.");
  }
  const text = await readTextFile(file);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Le fichier choisi n'est pas un JSON valide.");
  }
}

async function confirmPeopleImportPreview(importedPeople, current) {
  const sample = importedPeople.slice(0, 8).map(displayName).join("\n- ");
  return askConfirm(
    "Previsualisation import",
    `L'arbre ouvert "${current.name}" sera remplace par ${importedPeople.length} fiche(s).\n\nApercu :\n- ${sample || "Aucune fiche"}\n\nLes donnees actuelles de cet arbre seront remplacees.`,
    { confirmText: "Importer et remplacer", cancelText: "Annuler", danger: true }
  );
}

async function confirmFullImportPreview(importedState, count) {
  const sample = importedState.genealogies
    .slice(0, 8)
    .map((genealogy) => `${genealogy.name} (${genealogy.people.length} fiche(s))`)
    .join("\n- ");
  return askConfirm(
    "Previsualisation import complet",
    `Le site sera remplace par ${importedState.genealogies.length} arbre(s) et ${count} fiche(s).\n\nApercu :\n- ${sample || "Aucun arbre"}\n\nCette action remplace toutes les donnees du site.`,
    { confirmText: "Importer et remplacer", cancelText: "Annuler", danger: true, requiredText: "IMPORTER" }
  );
}

function peoplePayloadForActiveImport(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.people)) return payload.people;
  if (Array.isArray(payload?.genealogy?.people)) return payload.genealogy.people;
  if (!Array.isArray(payload?.genealogies)) return null;

  const current = activeGenealogy();
  const matchingGenealogy =
    payload.genealogies.find((item) => item.id === current.id || item.name === current.name) ||
    payload.genealogies.find((item) => item.id === payload.activeGenealogyId) ||
    payload.genealogies[0];
  return matchingGenealogy?.people || null;
}

function genealogyPayloadForFullImport(payload) {
  if (Array.isArray(payload?.genealogies)) return payload;
  if (payload?.genealogy) {
    return {
      activeGenealogyId: payload.genealogy.id,
      genealogies: [payload.genealogy],
    };
  }
  if (Array.isArray(payload?.people)) {
    return {
      activeGenealogyId: "import",
      genealogies: [
        {
          id: "import",
          name: payload.name || payload.groupName || "Import",
          photoData: payload.photoData || "",
          people: payload.people,
        },
      ],
    };
  }
  if (Array.isArray(payload)) {
    return {
      activeGenealogyId: "import",
      genealogies: [{ id: "import", name: "Import", photoData: "", people: payload }],
    };
  }
  return payload;
}

function normaliseFiliere(value) {
  const rawId = String(value || "").trim();
  const id = filiereLegacyIds[rawId] || rawId;
  return filiereOptions.some((item) => item.id === id) ? id : "";
}

function filiereLabel(id) {
  return filiereOption(id)?.label || uiLabels.empty.unknownFiliere;
}

function filiereOption(id) {
  const normalisedId = filiereLegacyIds[id] || id;
  return filiereOptions.find((item) => item.id === normalisedId) || null;
}

function filiereOptionsForGroup(groupId) {
  return filiereOptions.filter((option) => option.statGroup === groupId);
}

function filiereStrip(id) {
  return filiereOption(id)?.strip || "";
}

function filiereStyleAttr(id) {
  const strip = filiereStrip(id);
  return strip ? `style="--filiere-strip: ${escapeHtml(strip)}"` : "";
}

function filiereSwatchHtml(id) {
  const strip = filiereStrip(id);
  return `<i class="filiere-swatch" ${strip ? `style="--filiere-strip: ${escapeHtml(strip)}"` : ""}></i>`;
}

function todayIso() {
  return new Date().toISOString();
}

function normaliseRoleOptions(value) {
  if (!Array.isArray(value)) return [];
  const roles = [];
  const byId = new Map();
  const byLabel = new Map();

  value.forEach((item) => {
    const label = String(item?.label || item?.name || item || "").trim();
    const id = normaliseRoleId(item?.id || label);
    const aliases = uniqueIds([id, ...toIdArray(item?.aliases).map(normaliseRoleId)]).filter(Boolean);
    const labelIdentity = normalisedText(label);
    if (!id || !label) return;

    const existing = byId.get(id) || (labelIdentity ? byLabel.get(labelIdentity) : null);
    if (existing) {
      existing.aliases = uniqueIds([...(existing.aliases || [existing.id]), ...aliases]);
      aliases.forEach((alias) => byId.set(alias, existing));
      return;
    }

    const role = { id, label, aliases };
    roles.push(role);
    aliases.forEach((alias) => byId.set(alias, role));
    if (labelIdentity) byLabel.set(labelIdentity, role);
  });

  return roles.map(({ id, label, aliases }) => (aliases.length > 1 ? { id, label, aliases } : { id, label }));
}

function mergeRoleOptions(...groups) {
  const byIdentity = new Map();
  const byId = new Map();
  groups.flat().forEach((role) => {
    if (!role?.id) return;
    const label = role.label || roleLabelFromId(role.id);
    const identity = normalisedText(label) || role.id;
    const aliases = uniqueIds([role.id, ...(role.aliases || [])]).filter(Boolean);
    const existing = byIdentity.get(identity) || aliases.map((alias) => byId.get(alias)).find(Boolean);
    if (existing) {
      existing.aliases = uniqueIds([...(existing.aliases || [existing.id]), ...aliases]);
      aliases.forEach((alias) => byId.set(alias, existing));
      return;
    }
    const mergedRole = { id: role.id, label, aliases };
    byIdentity.set(identity, mergedRole);
    aliases.forEach((alias) => byId.set(alias, mergedRole));
  });
  return [...byIdentity.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

function allRoleOptions() {
  if (typeof state === "undefined") return defaultRoleOptions;
  const customRoles = state.genealogies.flatMap((genealogy) => genealogy.customRoles || []);
  const usedRoles = state.genealogies
    .flatMap((genealogy) => genealogy.people || [])
    .flatMap((person) => normaliseRoles(person.roles))
    .map((id) => ({ id, label: roleLabelFromId(id) }));
  return mergeRoleOptions(defaultRoleOptions, customRoles, usedRoles);
}

function roleRegionForGenealogy(genealogy) {
  return regionalGenealogyFor(genealogy) || (isRegionalGenealogy(genealogy) ? genealogy : null);
}

function roleOptionsForGenealogy(genealogy, selectedRoles = []) {
  if (typeof state === "undefined") return defaultRoleOptions;
  if (!genealogy || isMainGenealogy(genealogy)) {
    return mergeRoleOptions(allRoleOptions(), selectedRoles.map((id) => ({ id, label: roleLabel(id) })));
  }
  const region = roleRegionForGenealogy(genealogy);
  const scope = region ? regionalScopeGenealogies(region) : [genealogy];
  const usedRoles = scope
    .flatMap((item) => item.people || [])
    .flatMap((person) => normaliseRoles(person.roles))
    .map((id) => ({ id, label: roleLabel(id) }));
  return mergeRoleOptions(
    defaultRoleOptions,
    region?.customRoles || [],
    usedRoles,
    selectedRoles.map((id) => ({ id, label: roleLabel(id) }))
  );
}

function roleOptionsForStatsScope(genealogies) {
  const customRoles = genealogies
    .filter((genealogy) => isRegionalGenealogy(genealogy))
    .flatMap((genealogy) => genealogy.customRoles || []);
  const parentRegionRoles = genealogies
    .filter(isFamilyGenealogy)
    .map((genealogy) => state.genealogies.find((item) => item.id === genealogy.parentId))
    .filter(Boolean)
    .flatMap((genealogy) => genealogy.customRoles || []);
  const usedRoles = genealogies
    .flatMap((genealogy) => genealogy.people || [])
    .flatMap((person) => normaliseRoles(person.roles))
    .map((id) => ({ id, label: roleLabel(id) }));
  return mergeRoleOptions(defaultRoleOptions, customRoles, parentRegionRoles, usedRoles);
}

function canonicaliseRoleIds(value, options = allRoleOptions()) {
  const canonicalIds = new Map();
  options.forEach((role) => {
    (role.aliases || [role.id]).forEach((roleId) => {
      canonicalIds.set(roleId, role.id);
    });
  });
  return uniqueIds(normaliseRoles(value).map((roleId) => canonicalIds.get(roleId) || roleId));
}

function publicGenealogies(genealogies) {
  return genealogies.map(({ adminPassword, ...genealogy }) => genealogy);
}

function persistLocal() {
  syncActiveGenealogy();
  saveStoredGenealogyState({
    roleResetVersion,
    activeGenealogyId: state.activeGenealogyId,
    genealogies: publicGenealogies(state.genealogies),
    upcomingBaptisms: state.upcomingBaptisms,
  });
}

function persist() {
  persistLocal();
  saveRemoteGenealogy();
}

async function saveRemoteGenealogy() {
  if (!canUseRemoteApi()) {
    setServerStatus("offline");
    return;
  }
  const formRevision = state.formEditRevision;

  try {
    setServerStatus("saving");
    syncActiveGenealogy();
    const response = await saveGenealogyRequest(
      genealogySavePayload({
        roleResetVersion,
        activeGenealogyId: state.activeGenealogyId,
        genealogies: publicGenealogies(state.genealogies),
        upcomingBaptisms: state.upcomingBaptisms,
      }),
      csrfFetch
    );

    if (!response.ok) {
      const message = await readResponseMessage(response);
      setServerStatus("error");
      showToast(`Sauvegarde en ligne echouee : ${message}`, "error");
      return;
    }

    const payload = await response.json();
    if (payload?.state && !shouldProtectPersonFormFromRemoteRefresh(formRevision)) {
      applyRemoteGenealogyPayload(payload.state, false);
      persistLocal();
      render();
    }
    state.remoteReady = true;
    setServerStatus("saved");
  } catch {
    setServerStatus("error");
    showToast("Impossible de joindre la sauvegarde en ligne. La modification reste locale.", "error");
  }
}

async function ensureCsrfToken(forceRefresh = false) {
  if (!canUseRemoteApi()) return "";
  if (state.csrfToken && !forceRefresh) return state.csrfToken;

  state.csrfToken = await fetchCsrfToken(fetch);
  return state.csrfToken;
}

async function csrfFetch(url, options = {}, retry = true) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  const nextOptions = {
    ...options,
    method,
    credentials: "same-origin",
    headers,
  };

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = await ensureCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }

  const response = await fetch(url, nextOptions);
  if (response.status === 403 && retry && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    state.csrfToken = "";
    const token = await ensureCsrfToken(true);
    if (!token) return response;
    headers.set("X-CSRF-Token", token);
    return csrfFetch(url, { ...nextOptions, headers }, false);
  }
  return response;
}

function preventPannedClick(event) {
  event.preventDefault();
  event.stopPropagation();
}

function selectGraphNodeCard(card) {
  const personId = card.dataset.personId;
  const cardGenealogyId = card.dataset.genealogyId || state.activeGenealogyId;
  if (!personId) return;
  if (cardGenealogyId !== state.activeGenealogyId) {
    selectPersonFromGenealogy(cardGenealogyId, personId);
    return;
  }
  if (!getPerson(personId)) return;
  state.selectedId = personId;
  rememberRecentPerson(cardGenealogyId, personId);
  render();
}

function loadDoleancesLocal() {
  return normaliseDoleances(loadStoredJson({ key: storageKeys.doleances, fallback: [] }));
}

function saveDoleancesLocal() {
  saveStoredJson(state.doleances, { key: storageKeys.doleances });
}

async function openDoleancePanel() {
  state.doleancePanelOpen = true;
  renderDoleanceButton();
  renderDoleancePanel();
  if (isGeneralAdmin()) await loadDoleancesForAdmin();
}

function renderDoleanceButton() {
  const pendingCount = isGeneralAdmin() ? pendingDoleanceCount(state.doleances) : 0;
  els.doleanceButton.textContent = pendingCount ? `Dol\u00e9ances (${pendingCount})` : "Dol\u00e9ances";
  els.doleanceButton.classList.toggle("is-active", state.doleancePanelOpen);
}

function renderDoleancePanel() {
  if (!state.doleancePanelOpen) {
    els.doleancePanel.hidden = true;
    els.doleancePanel.innerHTML = "";
    return;
  }

  els.doleancePanel.hidden = false;
  els.doleancePanel.innerHTML = isGeneralAdmin() ? adminDoleancePanelHtml(state.doleances) : publicDoleancePanelHtml();
}

async function submitDoleance(form) {
  const data = new FormData(form);
  const type = normaliseDoleanceType(data.get("type"));
  const target = String(data.get("target") || "").trim().slice(0, 160);
  const message = String(data.get("message") || "").trim().slice(0, 2000);
  if (!message) {
    await showMessage("Message requis", "Ajoute un message avant d'envoyer la doleance.");
    return;
  }

  const payload = { type, target, message };
  const remoteResult = await createRemoteDoleance(payload);
  if (remoteResult.limited) {
    await showMessage("Limite atteinte", remoteResult.message || "Limite de doleances atteinte pour cette session.");
    return;
  }
  if (!remoteResult.ok) {
    state.doleances = normaliseDoleances([...state.doleances, makeDoleance(payload)]);
    saveDoleancesLocal();
  }

  state.doleancePanelOpen = false;
  renderDoleanceButton();
  renderDoleancePanel();
  showToast("Doleance envoyee anonymement.");
}

async function loadDoleancesForAdmin() {
  if (!isGeneralAdmin()) return;
  const remoteDoleances = await fetchRemoteDoleances();
  if (remoteDoleances) {
    state.doleances = remoteDoleances;
    saveDoleancesLocal();
  }
  renderDoleanceButton();
  renderDoleancePanel();
}

async function updateDoleanceStatus(id, status) {
  if (!isGeneralAdmin()) return;
  state.doleances = state.doleances.map((item) =>
    item.id === id ? { ...item, status: status === "resolved" ? "resolved" : "pending" } : item
  );
  await persistDoleancesForAdmin();
  renderDoleanceButton();
  renderDoleancePanel();
}

async function exitAdminMode() {
  if (isGeneralAdmin()) {
    state.doleances = state.doleances.filter((item) => item.status !== "resolved");
    await persistDoleancesForAdmin();
  }
  await logoutAdmin();
  state.adminMode = false;
  state.adminLevel = "";
  state.adminRegionId = "";
  state.adminRequiresPasswordChange = false;
  state.adminRegions = [];
  state.adminSelectedPersonIds = [];
  state.doleancePanelOpen = false;
  render();
}

async function persistDoleancesForAdmin() {
  if (!isGeneralAdmin()) return;
  state.doleances = normaliseDoleances(state.doleances);
  saveDoleancesLocal();
  if (!canUseRemoteApi()) return;

  try {
    const response = await saveDoleancesRequest(state.doleances, csrfFetch);
    if (!response.ok) {
      const message = await readResponseMessage(response);
      showToast(`La sauvegarde des doleances a echoue : ${message}`, "error");
      return;
    }
    const payload = await response.json();
    if (!payload.ok) {
      showToast("La sauvegarde des doleances a echoue. La copie locale reste disponible.", "error");
    }
  } catch {
    showToast("Impossible de joindre la sauvegarde des doleances. La copie locale reste disponible.", "error");
  }
}

async function createRemoteDoleance(payload) {
  if (!canUseRemoteApi()) return { ok: false };

  try {
    const response = await createDoleanceRequest(payload, csrfFetch);
    if (response.status === 429) {
      return { ok: false, limited: true, message: await readResponseMessage(response) };
    }
    if (!response.ok) return { ok: false };
    const result = await response.json();
    return { ok: result.ok === true };
  } catch {
    return { ok: false };
  }
}

async function fetchRemoteDoleances() {
  if (!canUseRemoteApi()) return null;

  try {
    const response = await fetchDoleancesRequest(csrfFetch);
    if (!response.ok) return null;
    const payload = await response.json();
    return normaliseDoleances(payload.doleances || []);
  } catch {
    return null;
  }
}

async function saveCurrentForm() {
  return savePeopleForm({
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
  });
}

function personFormPermissionMessage(selected, formData, crossGroup, targetPeople) {
  if (adminPasswordChangeRequired()) return "Change ton mot de passe admin regional avant de modifier les donnees.";
  if (state.adminMode) return "";
  if (!selected) return "";
  if (state.publicEditablePersonIds.includes(selected.id)) return "";
  if (isPublicRelationshipOrCeremonyChange(selected, formData, crossGroup, targetPeople)) return "";
  return "Sans mode admin, tu peux seulement modifier les parrains classiques ou ajouter une adoption/confirmation a une fiche existante.";
}

function isPublicRelationshipOrCeremonyChange(selected, formData, crossGroup, targetPeople) {
  return (
    stablePersonFieldsKey(selected) === stablePersonFieldsKey(formData) &&
    sameCrossGroupDraft(selected, crossGroup, targetPeople) &&
    sameStringArray(uniqueIds(selected.heartSponsorIds).sort(), uniqueIds(formData.heartSponsorIds).sort()) &&
    hasSameOrAddedCeremonyEvents(selected.ceremonyEvents, formData.ceremonyEvents)
  );
}

function stablePersonFieldsKey(person) {
  return JSON.stringify({
    name: String(person.name || "").trim(),
    nicknames: normaliseNicknames(person.nicknames, person.nickname),
    roles: canonicaliseRoleIds(person.roles),
    ceremonyType: normaliseCeremonyType(person.ceremonyType),
    baptismDate: String(person.baptismDate || "").trim(),
    baptismCity: String(person.baptismCity || "").trim(),
    baptismStatus: normaliseBaptismStatus(person.baptismStatus),
    song: String(person.song || "").trim(),
    filiere: normaliseFiliere(person.filiere),
  });
}

function sameCrossGroupDraft(selected, crossGroup, targetPeople) {
  const currentMembers = crossGroupMemberIdsFromPeople(targetPeople, selected).sort();
  const nextMembers = uniqueIds(crossGroup.memberIds).sort();
  const currentSize = currentMembers.length ? currentMembers.length + 1 : 0;
  const nextSize = crossGroup.size || 0;
  return currentSize === nextSize && sameStringArray(currentMembers, nextMembers);
}

function crossGroupMemberIdsFromPeople(people, selected) {
  if (!selected?.crossGroupId) return [];
  return people
    .filter((person) => person.id !== selected.id && person.crossGroupId === selected.crossGroupId)
    .map((person) => person.id);
}

function hasSameOrAddedCeremonyEvents(currentEvents, nextEvents) {
  const currentKeys = normaliseCeremonyEvents(currentEvents).map(ceremonyEventKey);
  const nextKeys = normaliseCeremonyEvents(nextEvents).map(ceremonyEventKey);
  if (nextKeys.length < currentKeys.length) return false;
  return currentKeys.every((key) => nextKeys.includes(key));
}

async function confirmDuplicateCreation(duplicates) {
  const lines = duplicates
    .map(({ person, genealogy }) => `- ${displayName(person)} dans ${genealogy.name}${person.baptismCity ? ` (${person.baptismCity})` : ""}`)
    .join("\n");
  return askConfirm(
    "Doublon possible",
    `Une fiche proche existe deja :\n\n${lines}\n\nVerifie avant de creer une nouvelle fiche.`,
    { confirmText: "Creer quand meme", cancelText: "Retour au formulaire" }
  );
}

function readCrossGroupForm(people = state.people) {
  const selectedIds = validPersonIdsFromPeople(state.draftCrossMemberIds, people);
  const requestedSize = Number(els.crossGroupSizeInput.value || 0);

  if (!requestedSize && selectedIds.length === 0) {
    return { size: 0, memberIds: [] };
  }

  const size = requestedSize || Math.min(selectedIds.length + 1, maxCrossGroupSize);
  const expectedMembers = size - 1;
  if (size < 2 || size > maxCrossGroupSize || selectedIds.length !== expectedMembers) {
    setFormErrors(
      [`Pour un bapteme en croisee, selectionne entre 2 et ${maxCrossGroupSize} personnes, avec le nombre exact d'autres personnes attendu.`],
      [els.crossGroupSizeInput]
    );
    return null;
  }

  return { size, memberIds: selectedIds };
}

function applyCrossGroupToPeople(people, targetId, size, memberIds) {
  if (!targetId) return people;
  const target = getPersonFromPeople(people, targetId);
  if (!target) return people;

  const groupIdsToClear = new Set(
    uniqueIds([targetId, ...memberIds])
      .map((id) => getPersonFromPeople(people, id)?.crossGroupId)
      .filter(Boolean)
  );
  const peopleWithoutOldGroup = people.map((person) =>
    groupIdsToClear.has(person.crossGroupId)
      ? { ...person, crossGroupId: "", crossGroupSize: 0 }
      : person
  );

  if (!size) {
    return normaliseCrossGroups(peopleWithoutOldGroup, maxCrossGroupSize);
  }

  const groupIds = uniqueIds([targetId, ...memberIds]).slice(0, size);
  const groupId = `cross-${groupIds.slice().sort().join("-")}`;
  return normaliseCrossGroups(
    peopleWithoutOldGroup.map((person) =>
      groupIds.includes(person.id)
        ? { ...person, ceremonyType: "bapteme", crossGroupId: groupId, crossGroupSize: size }
      : person
    ),
    maxCrossGroupSize
  );
}

function setClassicSponsorLink(fillotId, sponsorId, shouldAttach) {
  const fillot = getPerson(fillotId);
  const sponsor = getPerson(sponsorId);
  if (!fillot || !sponsor || fillot.id === sponsor.id) return false;

  const active = activeGenealogy();
  const activeIsAggregate = isAggregateGenealogy(active);
  const entry = activeIsAggregate
    ? sourceEntryForAggregatePerson(fillot, active)
    : { person: fillot, genealogy: active };
  if (!entry?.person || !entry?.genealogy) return false;
  if (state.adminMode && !genealogyInAdminScope(entry.genealogy)) return false;

  const updatedPeople = setClassicSponsorLinkInPeople(
    entry.genealogy.people,
    entry.person,
    sponsor,
    entry.genealogy,
    shouldAttach
  );
  if (!updatedPeople) return false;

  if (activeIsAggregate) {
    state.genealogies = state.genealogies.map((genealogy) =>
      genealogy.id === entry.genealogy.id ? { ...genealogy, people: updatedPeople } : genealogy
    );
    state.genealogies = withMainGenealogyPeople(state.genealogies);
    state.people = activeGenealogy().people;
  } else {
    state.people = updatedPeople;
  }

  persist();
  render();
  return true;
}

function setClassicSponsorLinkInPeople(people, fillot, sponsor, genealogy, shouldAttach) {
  const targetSponsorIds = relationshipPersonIdsFor(sponsor, genealogy).filter((id) => id !== fillot.id);
  if (shouldAttach && !targetSponsorIds.length) return null;

  const fallbackRemoveIds = shouldAttach ? [] : [sponsor.id];
  const idsToRemove = new Set(uniqueIds([...targetSponsorIds, ...fallbackRemoveIds]));
  let changed = false;

  const updated = people.map((person) => {
    if (person.id !== fillot.id) return person;
    const sponsorIds = uniqueIds(person.sponsorIds);
    const heartSponsorIds = uniqueIds(person.heartSponsorIds);

    if (shouldAttach) {
      const nextSponsorIds = uniqueIds([...sponsorIds, targetSponsorIds[0]]);
      if (sameStringArray(sponsorIds, nextSponsorIds)) return person;
      changed = true;
      return { ...person, sponsorIds: nextSponsorIds };
    }

    const heartSponsorSet = new Set(heartSponsorIds);
    const nextSponsorIds = sponsorIds.filter((id) => !idsToRemove.has(id) || heartSponsorSet.has(id));
    if (sameStringArray(sponsorIds, nextSponsorIds)) {
      return person;
    }
    changed = true;
    return { ...person, sponsorIds: nextSponsorIds };
  });

  return changed ? normaliseCrossGroups(updated, maxCrossGroupSize) : people;
}

function relationshipPersonIdsFor(person, genealogy) {
  const key = statPersonKey(person);
  return uniqueIds(
    relationshipPeopleForGenealogy(genealogy)
      .filter((candidate) => candidate.id === person.id || statPersonKey(candidate) === key)
      .map((candidate) => candidate.id)
  );
}

function removeClassicFillot(fillotId) {
  const sponsor = getPerson(state.selectedId);
  if (!sponsor || !fillotId) return;
  if (!setClassicSponsorLink(fillotId, sponsor.id, false)) {
    void showMessage("Lien impossible", "Ce fillot ne peut pas etre retire depuis l'arbre ouvert.");
  }
}

async function deletePersonById(personId, shouldConfirm = false) {
  return deletePeopleByIds([personId], shouldConfirm);
}

async function deletePeopleByIds(personIds, shouldConfirm = false) {
  const ids = uniqueIds(personIds).filter((id) => getPerson(id));
  const people = ids.map((id) => getPerson(id)).filter(Boolean);
  if (!people.length) return false;

  const selectedPerson = getPerson(state.selectedId);
  const active = activeGenealogy();
  if (state.adminMode && !genealogyInAdminScope(active)) {
    await showMessage("Action bloquee", "Cet admin regional ne peut pas supprimer dans cette genealogie.");
    return false;
  }
  const activeIsAggregate = isAggregateGenealogy(active);
  const removedKeys = new Set(people.map(statPersonKey));
  const label = people.length === 1 ? displayName(people[0]) : `${people.length} fiches`;
  const scope = isMainGenealogy(active) ? " dans tous les arbres" : isRegionalGenealogy(active) ? ` dans ${active.name}` : "";
  if (shouldConfirm) {
    const confirmed = await askConfirm(
      "Supprimer une fiche",
      `Supprimer ${label}${scope} et retirer les liens de parrainage associes ?`,
      { confirmText: "Supprimer", cancelText: "Annuler", danger: true, requiredText: "SUPPRIMER" }
    );
    if (!confirmed) return false;
  }

  if (activeIsAggregate) {
    const scopeIds = isMainGenealogy(active)
      ? new Set(state.genealogies.map((genealogy) => genealogy.id))
      : new Set(regionalScopeGenealogies(active).map((genealogy) => genealogy.id));
    state.genealogies = state.genealogies.map((genealogy) => ({
      ...genealogy,
      people: scopeIds.has(genealogy.id)
        ? removePeopleFromPeopleByPredicate(genealogy.people, (person) => removedKeys.has(statPersonKey(person)))
        : genealogy.people,
    }));
    state.genealogies = withMainGenealogyPeople(state.genealogies);
    state.people = activeGenealogy().people;
  } else {
    state.people = removePeopleFromPeople(state.people, ids);
  }

  const selectedWasRemoved = selectedPerson && removedKeys.has(statPersonKey(selectedPerson));
  state.selectedId = selectedWasRemoved || !getPerson(state.selectedId) ? state.people[0]?.id ?? null : state.selectedId;
  state.adminSelectedPersonIds = [];
  resetFormDraft();
  persist();
  render();
  return true;
}

async function transferPersonToGenealogy(personId, targetGenealogyId) {
  return transferPeopleToGenealogy([personId], targetGenealogyId, true);
}

async function transferPeopleToGenealogy(personIds, targetGenealogyId, shouldConfirm = true) {
  const source = activeGenealogy();
  const target = state.genealogies.find((genealogy) => genealogy.id === targetGenealogyId);
  const ids = uniqueIds(personIds);
  const people = ids.map((id) => getPerson(id)).filter(Boolean);
  if (!people.length || !target || target.id === source.id) return false;
  if (state.adminMode && (!genealogyInAdminScope(source) || !genealogyInAdminScope(target))) {
    await showMessage("Action bloquee", "Cet admin regional peut transferer uniquement dans sa region.");
    return false;
  }

  const activeIsAggregate = isAggregateGenealogy(source);
  const label = people.length === 1 ? displayName(people[0]) : `${people.length} fiches`;
  const action = activeIsAggregate ? "Ajouter" : "Transferer";
  const sourceText = activeIsAggregate ? "" : ` depuis "${source.name}"`;
  if (shouldConfirm) {
    const confirmed = await askConfirm(
      `${action} des fiches`,
      `${action} ${label}${sourceText} vers "${target.name}" ?`,
      { confirmText: action, cancelText: "Annuler" }
    );
    if (!confirmed) return false;
  }

  const sourcePeople = activeIsAggregate ? state.people : removePeopleFromPeople(state.people, ids);
  const targetPeople = mergePeopleIntoGenealogy(target.people, people);

  state.genealogies = state.genealogies.map((genealogy) => {
    if (!activeIsAggregate && genealogy.id === source.id) return { ...genealogy, people: sourcePeople };
    if (genealogy.id === target.id) return { ...genealogy, people: targetPeople };
    return genealogy;
  });
  state.genealogies = withMainGenealogyPeople(state.genealogies);
  state.people = sourcePeople;
  if (activeIsAggregate) state.people = activeGenealogy().people;
  const selectedWasMoved = !activeIsAggregate && ids.includes(state.selectedId);
  state.selectedId = selectedWasMoved || !getPerson(state.selectedId) ? state.people[0]?.id ?? null : state.selectedId;
  state.adminSelectedPersonIds = [];
  resetFormDraft();
  persist();
  render();
  return true;
}

function mergePeopleIntoGenealogy(targetPeople, people) {
  const nextPeople = [...targetPeople];
  const usedIds = new Set(nextPeople.map((person) => person.id));
  const existingIdByKey = new Map(nextPeople.map((person) => [statPersonKey(person), person.id]));
  const idMap = new Map();

  people.forEach((person) => {
    const key = statPersonKey(person);
    const existingId = existingIdByKey.get(key);
    if (existingId) {
      idMap.set(person.id, existingId);
      return;
    }

    const id = uniquePersonIdFrom(person.id, usedIds);
    usedIds.add(id);
    existingIdByKey.set(key, id);
    idMap.set(person.id, id);
  });

  const addedKeys = new Set(nextPeople.map(statPersonKey));
  people.forEach((person) => {
    const key = statPersonKey(person);
    if (addedKeys.has(key)) return;

    const id = idMap.get(person.id);
    const allowedIds = new Set([...nextPeople.map((item) => item.id), ...idMap.values()]);
    const remapLinkedIds = (ids) =>
      uniqueIds(ids.map((linkedId) => idMap.get(linkedId) || linkedId)).filter(
        (linkedId) => allowedIds.has(linkedId) && linkedId !== id
      );

    nextPeople.push({
      ...person,
      id,
      sponsorIds: remapLinkedIds(person.sponsorIds),
      heartSponsorIds: remapLinkedIds(person.heartSponsorIds),
      ceremonyEvents: normaliseCeremonyEvents(person.ceremonyEvents).map((event) => ({
        ...event,
        sponsorIds: remapLinkedIds(event.sponsorIds),
      })),
      crossGroupId: "",
      crossGroupSize: 0,
    });
    addedKeys.add(key);
  });

  return normaliseCrossGroups(nextPeople, maxCrossGroupSize);
}

function removePeopleFromPeople(people, personIds) {
  const ids = new Set(uniqueIds(personIds));
  return removePeopleFromPeopleByPredicate(people, (person) => ids.has(person.id));
}

function removePeopleFromPeopleByPredicate(people, shouldRemove) {
  const removedIds = new Set(people.filter(shouldRemove).map((person) => person.id));
  if (!removedIds.size) return people;
  return normaliseCrossGroups(
    people
      .filter((item) => !removedIds.has(item.id))
      .map((item) => ({
        ...item,
        sponsorIds: item.sponsorIds.filter((id) => !removedIds.has(id)),
        heartSponsorIds: item.heartSponsorIds.filter((id) => !removedIds.has(id)),
        ceremonyEvents: normaliseCeremonyEvents(item.ceremonyEvents).map((event) => ({
          ...event,
          sponsorIds: event.sponsorIds.filter((id) => !removedIds.has(id)),
        })),
      })),
    maxCrossGroupSize
  );
}

function resetFormDraft() {
  state.formPersonId = null;
  state.formDirty = false;
  state.draftSponsorIds = [];
  state.draftHeartSponsorIds = [];
  state.draftCeremonyEvents = [];
  state.draftCrossMemberIds = [];
  state.draftCrossGroupSize = 0;
  els.nameInput.dataset.personId = "";
}

function ensureFormDraft(selected) {
  const formPersonId = selected?.id ?? "__new__";
  if (state.formPersonId === formPersonId) return;

  state.formPersonId = formPersonId;
  state.draftSponsorIds = selected ? [...selected.sponsorIds] : [...state.prefillSponsorIds];
  state.draftHeartSponsorIds = selected ? [...selected.heartSponsorIds] : [];
  state.draftCeremonyEvents = selected ? normaliseCeremonyEvents(selected.ceremonyEvents) : [];
  state.draftCrossMemberIds = selected
    ? getCrossGroupMembers(selected.id)
        .filter((person) => person.id !== selected.id)
        .map((person) => person.id)
    : [];
  state.draftCrossGroupSize = state.draftCrossMemberIds.length ? state.draftCrossMemberIds.length + 1 : 0;
}

function markFormDirty() {
  state.formDirty = true;
  state.formEditRevision += 1;
  saveFormDraftLocal();
}

function setFormErrors(messages, fields = []) {
  const list = messages.filter(Boolean);
  if (els.formErrors) {
    els.formErrors.hidden = list.length === 0;
    els.formErrors.innerHTML = joinHtml(list, (message) => `<div>${escapeHtml(message)}</div>`);
  }
  els.personForm.querySelectorAll(".field-invalid").forEach((field) => field.classList.remove("field-invalid"));
  fields.filter(Boolean).forEach((field) => field.classList.add("field-invalid"));
}

function clearFormErrors() {
  setFormErrors([]);
}

function validatePersonForm() {
  const messages = [];
  const fields = [];
  if (!els.nameInput.value.trim()) {
    messages.push("Le nom est obligatoire.");
    fields.push(els.nameInput);
  }
  if (adminPasswordChangeRequired()) messages.push("Change ton mot de passe admin regional avant de modifier les donnees.");
  return { valid: messages.length === 0, messages, fields };
}

function currentFormDraftPayload() {
  if (state.formPersonId !== "__new__") return null;
  const hasContent = [
    els.nameInput.value,
    els.nicknameInput.value,
    els.nickname2Input.value,
    els.nickname3Input.value,
    els.baptismInput.value,
    els.baptismCityInput.value,
    els.songInput.value,
  ].some((value) => String(value || "").trim()) || state.draftSponsorIds.length || state.draftHeartSponsorIds.length;
  if (!hasContent) return null;
  return {
    savedAt: Date.now(),
    targetGenealogyId: state.formTargetGenealogyId,
    fields: {
      name: els.nameInput.value,
      nickname: els.nicknameInput.value,
      nickname2: els.nickname2Input.value,
      nickname3: els.nickname3Input.value,
      roles: [...els.rolesInput.selectedOptions].map((option) => option.value),
      baptismDate: els.baptismInput.value,
      baptismCity: els.baptismCityInput.value,
      baptismStatus: els.baptismStatusInput.value,
      song: els.songInput.value,
      filiere: els.filiereInput.value,
    },
    draftSponsorIds: state.draftSponsorIds,
    draftHeartSponsorIds: state.draftHeartSponsorIds,
    draftCeremonyEvents: state.draftCeremonyEvents,
    draftCrossMemberIds: state.draftCrossMemberIds,
    draftCrossGroupSize: state.draftCrossGroupSize,
  };
}

function saveFormDraftLocal() {
  if (!state.formDirty || state.formPersonId !== "__new__") return;
  const payload = currentFormDraftPayload();
  if (!payload) {
    clearFormDraftLocal();
    return;
  }
  saveStoredJson(payload, { key: storageKeys.formDraft });
}

function clearFormDraftLocal() {
  removeStoredValue({ key: storageKeys.formDraft });
}

function restoreFormDraftIfAvailable() {
  let draft = null;
  try {
    draft = loadStoredJson({ key: storageKeys.formDraft, fallback: null });
  } catch {
    clearFormDraftLocal();
    return;
  }
  if (!draft?.fields || Date.now() - Number(draft.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) return;
  state.selectedId = null;
  state.formTargetGenealogyId = genealogyById(draft.targetGenealogyId)?.id || state.activeGenealogyId;
  resetFormDraft();
  state.formPersonId = "__new__";
  state.formDirty = true;
  state.draftSponsorIds = toIdArray(draft.draftSponsorIds);
  state.draftHeartSponsorIds = toIdArray(draft.draftHeartSponsorIds);
  state.draftCeremonyEvents = normaliseCeremonyEvents(draft.draftCeremonyEvents);
  state.draftCrossMemberIds = toIdArray(draft.draftCrossMemberIds);
  state.draftCrossGroupSize = normaliseCrossGroupSize(draft.draftCrossGroupSize, maxCrossGroupSize);
  renderForm();
  els.nameInput.value = draft.fields.name || "";
  els.nicknameInput.value = draft.fields.nickname || "";
  els.nickname2Input.value = draft.fields.nickname2 || "";
  els.nickname3Input.value = draft.fields.nickname3 || "";
  els.baptismInput.value = draft.fields.baptismDate || "";
  els.baptismCityInput.value = draft.fields.baptismCity || "";
  els.baptismStatusInput.value = normaliseBaptismStatus(draft.fields.baptismStatus);
  els.songInput.value = draft.fields.song || "";
  els.filiereInput.value = normaliseFiliere(draft.fields.filiere);
  [...els.rolesInput.options].forEach((option) => {
    option.selected = toIdArray(draft.fields.roles).includes(option.value);
  });
  renderForm();
  showToast("Brouillon de fiche restaure.");
}

function addDraftPersonFromSearch(key, input, options = {}) {
  const query = String(input?.value || "").trim();
  if (!query) return false;
  const candidates = draftPersonSearchCandidates(key);
  const match = findPersonFromSearch(query, candidates, options);
  if (!match) return false;
  input.value = "";
  addDraftPerson(key, match.id);
  return true;
}

function draftPersonSearchCandidates(key) {
  if (key !== "draftSponsorIds") {
    return formPeopleForDraft().filter((person) => !state[key]?.includes(person.id));
  }
  const formGenealogy = editableSelectedPersonEntry()?.genealogy || formTargetGenealogy();
  const selected = editableSelectedPersonEntry()?.person ?? null;
  const blockedSponsorIds = selected
    ? new Set(flattenGroups(getDescendantsByDepthFromPeople(formGenealogy.people, selected.id)).map((person) => person.id))
    : new Set();
  return relationshipPeopleForGenealogy(formGenealogy)
    .filter((person) => person.id !== selected?.id)
    .filter((person) => !blockedSponsorIds.has(person.id))
    .filter((person) => !state.draftSponsorIds.includes(person.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
}

function findPersonFromSearch(query, people, options = {}) {
  const key = normalisedText(query);
  if (!key) return null;
  const exact = people.find((person) => normalisedText(displayName(person)) === key);
  if (exact || options.exactOnly) return exact || null;
  return (
    people.find((person) => normalisedText(displayName(person)).startsWith(key)) ||
    people.find((person) => normalisedText(displayName(person)).includes(key)) ||
    null
  );
}

function addDraftPerson(key, id) {
  if (!id || !getPersonFromPeople(formPeopleForDraft(), id)) return;
  markFormDirty();
  addDraftPersonAction(state, key, id);
  renderForm();
}

function removeDraftPerson(key, id) {
  markFormDirty();
  removeDraftPersonAction(state, key, id);
  renderForm();
}

function removeExtraCeremony(id) {
  if (!canRemoveDraftCeremony(id)) {
    void showMessage("Modification reservee", "Seul un admin peut modifier ou retirer une ceremonie deja enregistree.");
    return;
  }
  markFormDirty();
  removeExtraCeremonyAction(state, id);
  renderForm();
}

function canRemoveDraftCeremony(id) {
  const selected = editableSelectedPersonEntry()?.person ?? null;
  if (!selected) return true;
  if (state.adminMode || state.publicEditablePersonIds.includes(selected.id)) return true;
  return !normaliseCeremonyEvents(selected.ceremonyEvents).some((event) => event.id === id);
}

function render() {
  renderGenealogyMenu();
  renderLayoutOptions();
  renderDoleanceButton();
  renderDoleancePanel();
  renderForm();
  renderFillotTools();
  renderDetails();
  renderAdminTools();
  renderGraph();
}

function renderGenealogyMenu() {
  const current = activeGenealogy();
  els.genealogyTitle.textContent = current.name;
  els.brandMark.src = current.photoData || defaultGenealogyPhotoSrc;
  els.genealogyList.innerHTML = sortedGenealogiesForMenu()
    .map(
      (item) => {
        const imageSrc = item.photoData || defaultGenealogyPhotoSrc;
        const depth = genealogyDepth(item);
        return (
        `<button class="genealogy-option genealogy-depth-${depth}${item.id === state.activeGenealogyId ? " is-active" : ""}" type="button" data-genealogy-id="${escapeHtml(item.id)}">
          <span class="genealogy-option-main">
            <img src="${escapeHtml(imageSrc)}" alt="" />
            <span>${escapeHtml(item.name)}<em>${escapeHtml(genealogyTypeLabel(item))}</em></span>
          </span>
          <small>${item.people.length} fiche(s)</small>
        </button>`
        );
      }
    )
    .join("");
  els.deleteGenealogyButton.disabled = state.genealogies.length <= 1 || isMainGenealogy(current);
}

function sortedGenealogiesForMenu() {
  const index = genealogyIndexFor();
  const national = index.main ? [index.main] : state.genealogies.filter(isMainGenealogy);
  const current = activeGenealogy();
  const expandedRegionId =
    state.expandedGenealogyRegionId ||
    (isRegionalGenealogy(current) ? current.id : regionalGenealogyFor(current)?.id || "");
  return [
    ...national,
    ...index.regions.flatMap((region) => [
      region,
      ...(region.id === expandedRegionId ? index.familiesByParentId.get(region.id) || [] : []),
    ]),
  ];
}

function genealogyDepth(genealogy) {
  if (isMainGenealogy(genealogy)) return 0;
  if (isRegionalGenealogy(genealogy)) return 1;
  return 2;
}

function genealogyTypeLabel(genealogy) {
  if (isMainGenealogy(genealogy)) return "National";
  if (isRegionalGenealogy(genealogy)) return "Region / ville";
  const region = regionalGenealogyFor(genealogy);
  return region ? `Famille - ${region.name}` : "Famille";
}

function genealogyForBaptismCity(city) {
  const key = normalisedText(city);
  if (!key) return null;
  const regions = state.genealogies.filter(isRegionalGenealogy);
  const cityAliases = [
    { city: "strasbourg", hints: ["alsace", "alsacienne", "strasbourg"] },
    { city: "lille", hints: ["lille", "lilloise"] },
    { city: "paris", hints: ["paris", "parisienne"] },
    { city: "lyon", hints: ["lyon", "lyonnaise"] },
    { city: "marseille", hints: ["marseille", "marseillaise"] },
    { city: "toulouse", hints: ["toulouse", "toulousaine"] },
    { city: "bordeaux", hints: ["bordeaux", "bordelaise"] },
    { city: "nantes", hints: ["nantes", "nantaise"] },
    { city: "rennes", hints: ["rennes", "rennaise"] },
    { city: "montpellier", hints: ["montpellier", "montpellieraine"] },
    { city: "nancy", hints: ["nancy", "nancienne"] },
    { city: "reims", hints: ["reims", "remoise"] },
    { city: "grenoble", hints: ["grenoble", "grenobloise"] },
    { city: "poitiers", hints: ["poitiers", "poitevine"] },
    { city: "dijon", hints: ["dijon", "dijonnaise"] },
    { city: "besancon", hints: ["besancon", "bisontine"] },
    { city: "clermont ferrand", hints: ["clermont", "auvergne", "auvergnate"] },
    { city: "caen", hints: ["caen", "normandie", "normande"] },
    { city: "rouen", hints: ["rouen", "normandie", "normande"] },
    { city: "amiens", hints: ["amiens", "picardie", "picarde"] },
    { city: "tours", hints: ["tours", "tourangelle"] },
    { city: "orleans", hints: ["orleans", "orleanaise"] },
    { city: "nice", hints: ["nice", "nicoise"] },
  ];
  const alias = cityAliases.find((item) => normalisedText(item.city) === key);
  if (alias) {
    const fromAlias = regions.find((region) => {
      const identity = normalisedText(`${region.id} ${region.name}`);
      return alias.hints.some((hint) => identity.includes(normalisedText(hint)));
    });
    if (fromAlias) return fromAlias;
  }

  const exact = regions.find((region) => regionSearchTerms(region).some((term) => term === key));
  if (exact) return exact;
  return regions.find((region) => regionSearchTerms(region).some((term) => term.includes(key) || key.includes(term))) || null;
}

function regionSearchTerms(region) {
  const name = normalisedText(region?.name);
  const id = normalisedText(region?.id).replace(/-/g, " ");
  const cleanName = name
    .replace(/^la faluche\s+/, "")
    .replace(/^faluche\s+/, "")
    .replace(/\s+de\s+/, " ")
    .trim();
  return uniqueIds([name, id, cleanName]).filter(Boolean);
}

function renderLayoutOptions() {
  const isSmartphone = isSmartphoneViewport();
  if (!isSmartphone) state.showEditor = true;
  document.body.classList.toggle("hide-editor", state.mode === "upcoming" || (isSmartphone && !state.showEditor));
  document.body.classList.toggle("upcoming-mode", state.mode === "upcoming");
  els.showEditorInput.checked = state.showEditor;
  els.showEditorInput.disabled = false;
  els.ancestorDepthInput.value = String(state.ancestorDepth);
  els.descendantDepthInput.value = String(state.descendantDepth);
}

function renderUpcomingBaptisms() {
  const region = upcomingActiveRegion();
  const events = upcomingEventsForActiveRegion();
  els.focusTitle.textContent = "Events a venir";
  els.focusSubtitle.textContent = region
    ? `${events.length} annonce(s) visible(s) dans ${region.name}`
    : "Ouvre une faluche de region ou une famille pour voir les annonces.";

  if (!region) {
    els.graphStage.innerHTML = `<div class="upcoming-view"><p class="upcoming-empty">Ouvre une faluche de region ou une famille pour voir ses annonces a venir.</p></div>`;
    return;
  }

  const people = upcomingPeopleForRegion(region);
  const sortedPeople = people.sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
  const cooptageRoleLabel = cooptageRoleLabelForRegion(region);
  const cooptageOptions = cooptagePeopleForRegion(region, sortedPeople);
  const announcementKind = state.upcomingAnnouncementKind === "cooptage" ? "cooptage" : "ceremony";
  const sponsorCandidates = announcementKind === "cooptage" ? cooptageOptions : sortedPeople;
  const sponsorIds = upcomingSelectedSponsorIds(sponsorCandidates);
  const concernedIds = upcomingSelectedConcernedIds(sortedPeople);
  const draft = state.upcomingAnnouncementDraft || {};
  const canAnnounceCeremony = sortedPeople.length > 0;
  const canAnnounceCooptage = cooptageOptions.length > 0 && sortedPeople.length > 0;

  const formToggleHtml = `<div class="upcoming-actions">
    <button class="upcoming-form-toggle${announcementKind === "ceremony" && state.showUpcomingAnnouncementForm ? " is-active" : ""}" type="button" data-upcoming-form-toggle="ceremony" ${canAnnounceCeremony ? "" : "disabled"}>
      ${announcementKind === "ceremony" && state.showUpcomingAnnouncementForm ? "Masquer l'annonce" : "Annoncer un bapt&ecirc;me/adoption/confirmation"}
    </button>
    <button class="upcoming-form-toggle${announcementKind === "cooptage" && state.showUpcomingAnnouncementForm ? " is-active" : ""}" type="button" data-upcoming-form-toggle="cooptage" ${canAnnounceCooptage ? "" : "disabled"}>
      ${announcementKind === "cooptage" && state.showUpcomingAnnouncementForm ? "Masquer le cooptage" : "Annoncer un cooptage"}
    </button>
  </div>`;
  const formHtml = state.showUpcomingAnnouncementForm && (announcementKind === "cooptage" ? canAnnounceCooptage : canAnnounceCeremony)
    ? announcementKind === "cooptage"
      ? upcomingCooptageFormHtml(draft, sortedPeople, cooptageOptions, sponsorIds, concernedIds, cooptageRoleLabel)
      : upcomingCeremonyFormHtml(draft, sortedPeople, sponsorIds)
    : !sortedPeople.length
      ? `<p class="upcoming-empty">Aucun faluchard n'est disponible dans ${escapeHtml(region.name)} pour creer une annonce.</p>`
      : state.upcomingAnnouncementKind === "cooptage" && !canAnnounceCooptage
        ? `<p class="upcoming-empty">Ajoute au moins une pastille ${escapeHtml(cooptageRoleLabel)} pour annoncer un cooptage.</p>`
        : "";

  const listHtml = events.length
    ? joinHtml(events, (event) =>
        renderUpcomingBaptismCardHtml({
          event,
          people,
          region,
          expandedUpcomingId: state.expandedUpcomingId,
          selectedEventIds: state.upcomingSelectedEventIds,
          adminMode: state.adminMode,
          displayName,
          getPersonFromPeople,
          uniqueNames,
          cooptageRoleLabelForRegion,
        })
      )
    : `<p class="upcoming-empty">Aucune annonce pour ${escapeHtml(region.name)}.</p>`;

  els.graphStage.innerHTML = `<div class="upcoming-view">
    <div class="upcoming-region-head">
      <h3>${escapeHtml(region.name)}</h3>
      <p>Les annonces restent visibles jusqu'au lendemain de l'evenement.</p>
    </div>
    ${formToggleHtml}
    ${formHtml}
    <form class="upcoming-request-box" data-upcoming-rsvp>
      <h3>Demander a venir</h3>
      <div class="upcoming-request-fields">
        <label>Nom
          <input name="name" maxlength="90" required />
        </label>
        <label>Surnom
          <input name="nickname" maxlength="90" />
        </label>
      </div>
      <p class="field-hint">Coche les annonces souhaitees dans la liste, puis envoie ta demande.</p>
      <button class="primary" type="submit">Est ce que je peux venir ?</button>
    </form>
    <div class="upcoming-list">${listHtml}</div>
  </div>`;
}

function upcomingCeremonyFormHtml(draft, sponsorOptions, sponsorIds) {
  return `<form class="upcoming-form" data-upcoming-form data-upcoming-kind="ceremony">
    <div class="upcoming-fields">
      <label>Type d'annonce
        <select name="eventType">
          <option value="bapteme" ${normaliseUpcomingEventType(draft.eventType) === "bapteme" ? "selected" : ""}>Bapt&ecirc;me</option>
          <option value="adoption" ${normaliseUpcomingEventType(draft.eventType) === "adoption" ? "selected" : ""}>Adoption</option>
          <option value="confirmation" ${normaliseUpcomingEventType(draft.eventType) === "confirmation" ? "selected" : ""}>Confirmation</option>
        </select>
      </label>
      <span></span>
      <div class="upcoming-sponsor-picker">
        <label>Parrain(s) / marraine(s)
          <div class="picker-row">
            <input data-upcoming-sponsor-search list="upcomingSponsorOptions" autocomplete="off" placeholder="Rechercher un parrain ou une marraine" value="${escapeHtml(draft.sponsorSearch || "")}" />
            <button class="text-button" type="button" data-upcoming-sponsor-add>Ajouter</button>
          </div>
        </label>
        <datalist id="upcomingSponsorOptions">
          ${joinHtml(
            sponsorOptions.filter((person) => !sponsorIds.includes(person.id)),
            (person) => `<option value="${escapeHtml(displayName(person))}"></option>`
          )}
        </datalist>
        ${renderUpcomingSponsorSelectionHtml({
          sponsorIds,
          people: sponsorOptions,
          emptyText: "Aucun parrain ou marraine ajoute.",
          displayName,
          getPersonFromPeople,
        })}
      </div>
      <label>Baptis&eacute;(s) concern&eacute;(s)
        <textarea name="baptizedNames" rows="4" maxlength="600" required placeholder="Un nom par ligne, ou separes par des virgules">${escapeHtml(draft.baptizedNames || "")}</textarea>
      </label>
      <label>Date et heure
        <input name="dateTime" type="datetime-local" required value="${escapeHtml(draft.dateTime || "")}" />
      </label>
      <label>Lieu
        <input name="place" maxlength="160" placeholder="Lieu de l'annonce" value="${escapeHtml(draft.place || "")}" />
      </label>
    </div>
    <label>Message
      <textarea name="message" rows="2" maxlength="600" placeholder="Infos utiles, heure, contact...">${escapeHtml(draft.message || "")}</textarea>
    </label>
    <button class="text-button" type="submit">Annoncer</button>
  </form>`;
}

function upcomingCooptageFormHtml(draft, people, cooptageOptions, cooptageIds, concernedIds, cooptageRoleLabel) {
  const concernedOptions = people.filter((person) => !cooptageIds.includes(person.id));
  return `<form class="upcoming-form" data-upcoming-form data-upcoming-kind="cooptage">
    <input type="hidden" name="eventType" value="cooptage" />
    <div class="upcoming-fields">
      <div class="upcoming-sponsor-picker">
        <label>${escapeHtml(cooptageRoleLabel)}
          <div class="picker-row">
            <input data-upcoming-sponsor-search list="upcomingCooptageRoleOptions" autocomplete="off" placeholder="Rechercher un ${escapeHtml(cooptageRoleLabel)}" value="${escapeHtml(draft.sponsorSearch || "")}" />
            <button class="text-button" type="button" data-upcoming-sponsor-add>Ajouter</button>
          </div>
        </label>
        <datalist id="upcomingCooptageRoleOptions">
          ${joinHtml(
            cooptageOptions.filter((person) => !cooptageIds.includes(person.id) && !concernedIds.includes(person.id)),
            (person) => `<option value="${escapeHtml(displayName(person))}"></option>`
          )}
        </datalist>
        ${renderUpcomingSponsorSelectionHtml({
          sponsorIds: cooptageIds,
          people,
          emptyText: `Aucun ${cooptageRoleLabel} ajoute.`,
          displayName,
          getPersonFromPeople,
        })}
      </div>
      <div class="upcoming-sponsor-picker">
        <label>Faluchard(s) concern&eacute;(s)
          <div class="picker-row">
            <input data-upcoming-concerned-search list="upcomingConcernedOptions" autocomplete="off" placeholder="Rechercher un faluchard" value="${escapeHtml(draft.concernedSearch || "")}" />
            <button class="text-button" type="button" data-upcoming-concerned-add>Ajouter</button>
          </div>
        </label>
        <datalist id="upcomingConcernedOptions">
          ${joinHtml(
            concernedOptions.filter((person) => !concernedIds.includes(person.id)),
            (person) => `<option value="${escapeHtml(displayName(person))}"></option>`
          )}
        </datalist>
        ${renderUpcomingConcernedSelectionHtml({
          personIds: concernedIds,
          people,
          displayName,
          getPersonFromPeople,
        })}
      </div>
      <label>Date et heure
        <input name="dateTime" type="datetime-local" required value="${escapeHtml(draft.dateTime || "")}" />
      </label>
      <label>Lieu
        <input name="place" maxlength="160" placeholder="Lieu de l'annonce" value="${escapeHtml(draft.place || "")}" />
      </label>
    </div>
    <label>Message
      <textarea name="message" rows="2" maxlength="600" placeholder="Infos utiles, contact...">${escapeHtml(draft.message || "")}</textarea>
    </label>
    <button class="text-button" type="submit">Annoncer le cooptage</button>
  </form>`;
}

function upcomingActiveRegion() {
  const active = activeGenealogy();
  if (!active || isMainGenealogy(active)) return null;
  return roleRegionForGenealogy(active) || active;
}

function upcomingPeopleForRegion(region) {
  return uniquePeopleById(regionalScopeGenealogies(region).flatMap((genealogy) => genealogy.people || []));
}

function upcomingSelectedSponsorIds(sponsors) {
  const sponsorIds = new Set(sponsors.map((person) => person.id));
  let selected = state.upcomingSponsorIds.filter((id) => sponsorIds.has(id));
  state.upcomingSponsorIds = selected;
  return selected;
}

function upcomingSelectedConcernedIds(people) {
  const personIds = new Set(people.map((person) => person.id));
  let selected = state.upcomingConcernedIds.filter((id) => personIds.has(id));
  state.upcomingConcernedIds = selected;
  return selected;
}

function personHasRole(person, roleId) {
  return canonicaliseRoleIds(person?.roles || []).includes(roleId);
}

function cooptageRoleOptionForRegion(region) {
  const storedRoleId = normaliseRoleId(region?.cooptageRoleId) || defaultCooptageRoleId;
  const options = roleOptionsForGenealogy(region, [defaultCooptageRoleId]);
  const matches = (role, roleId) => role.id === roleId || (role.aliases || []).includes(roleId);
  return (
    options.find((role) => matches(role, storedRoleId)) ||
    options.find((role) => matches(role, defaultCooptageRoleId)) ||
    { id: defaultCooptageRoleId, label: "TVA", aliases: [defaultCooptageRoleId] }
  );
}

function cooptageRoleIdForRegion(region) {
  return cooptageRoleOptionForRegion(region).id;
}

function cooptageRoleLabelForRegion(region) {
  const role = cooptageRoleOptionForRegion(region);
  return role.id === defaultCooptageRoleId ? "TVA" : role.label;
}

function cooptagePeopleForRegion(region, people = upcomingPeopleForRegion(region)) {
  const roleId = cooptageRoleIdForRegion(region);
  return people.filter((person) => personHasRole(person, roleId));
}

async function addUpcomingSponsorFromSearch(form) {
  if (!form) return;
  captureUpcomingAnnouncementDraft(form);
  const input = form.querySelector("[data-upcoming-sponsor-search]");
  const query = String(input?.value || "").trim();
  const region = upcomingActiveRegion();
  if (!region) return;
  const people = upcomingPeopleForRegion(region).sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
  const isCooptage = currentUpcomingAnnouncementKind(form) === "cooptage";
  const candidates = isCooptage ? cooptagePeopleForRegion(region, people) : people;
  const selectedIds = new Set(state.upcomingSponsorIds);
  const concernedIds = new Set(state.upcomingConcernedIds);
  const match = findUpcomingSponsor(query, candidates.filter((person) => !selectedIds.has(person.id) && (!isCooptage || !concernedIds.has(person.id))));
  if (!match) {
    await showMessage("Selection requise", isCooptage ? `Choisis un ${cooptageRoleLabelForRegion(region)} dans les suggestions.` : "Choisis un parrain ou une marraine dans les suggestions.");
    return;
  }
  addUpcomingSponsorAction(state, match.id);
  renderGraph();
}

async function addUpcomingConcernedFromSearch(form) {
  if (!form) return;
  captureUpcomingAnnouncementDraft(form);
  const input = form.querySelector("[data-upcoming-concerned-search]");
  const query = String(input?.value || "").trim();
  const region = upcomingActiveRegion();
  if (!region) return;
  const people = upcomingPeopleForRegion(region).sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
  const selectedIds = new Set(state.upcomingConcernedIds);
  const cooptageRolePersonIds = new Set(state.upcomingSponsorIds);
  const match = findUpcomingSponsor(query, people.filter((person) => !selectedIds.has(person.id) && !cooptageRolePersonIds.has(person.id)));
  if (!match) {
    await showMessage("Selection requise", "Choisis un faluchard dans les suggestions.");
    return;
  }
  addUpcomingConcernedAction(state, match.id);
  renderGraph();
}

function captureUpcomingAnnouncementDraft(form) {
  captureUpcomingAnnouncementDraftAction(state, form, FormData);
}

function currentUpcomingAnnouncementKind(form = null) {
  const type = normaliseUpcomingEventType(new FormData(form || document.createElement("form")).get("eventType"));
  if (type === "cooptage" || form?.dataset.upcomingKind === "cooptage") return "cooptage";
  return "ceremony";
}

function findUpcomingSponsor(query, people) {
  const key = normalisedText(query);
  if (!key) return null;
  return (
    people.find((person) => normalisedText(displayName(person)) === key) ||
    people.find((person) => normalisedText(displayName(person)).includes(key)) ||
    null
  );
}

function removeUpcomingSponsor(personId, form = null) {
  captureUpcomingAnnouncementDraft(form);
  removeUpcomingSponsorAction(state, personId);
  renderGraph();
}

function removeUpcomingConcerned(personId, form = null) {
  captureUpcomingAnnouncementDraft(form);
  removeUpcomingConcernedAction(state, personId);
  renderGraph();
}

function upcomingEventsForActiveRegion() {
  const region = upcomingActiveRegion();
  if (!region) return [];
  return state.upcomingBaptisms.filter((event) => event.regionId === region.id).sort(compareUpcomingBaptisms);
}

async function addUpcomingBaptism(form) {
  const region = upcomingActiveRegion();
  if (!region) return;
  const data = new FormData(form);
  const eventType = normaliseUpcomingEventType(data.get("eventType"));
  const people = upcomingPeopleForRegion(region);
  const allowedSponsors = eventType === "cooptage" ? cooptagePeopleForRegion(region, people) : people;
  const sponsorIds = validPersonIdsFromPeople(uniqueIds(data.getAll("sponsorIds").map(String).filter(Boolean)), allowedSponsors);
  const fillotIds = validPersonIdsFromPeople(uniqueIds(data.getAll("fillotIds").map(String).filter(Boolean)), people)
    .filter((id) => !sponsorIds.includes(id));
  const baptizedNames = normaliseUpcomingBaptizedNames(data.get("baptizedNames"));
  if (eventType === "cooptage" ? (!sponsorIds.length || !fillotIds.length) : (!sponsorIds.length || !baptizedNames.length)) {
    await showMessage("Annonce incomplete",
      eventType === "cooptage"
        ? `Ajoute au moins un ${cooptageRoleLabelForRegion(region)} et un faluchard concerne.`
        : "Ajoute au moins un parrain ou une marraine et un baptise concerne."
    );
    return;
  }
  const dateTime = normaliseDateTimeLocal(data.get("dateTime"));
  if (!dateTime) {
    await showMessage("Date requise", "Ajoute une date et une heure pour annoncer l'evenement.");
    return;
  }

  state.upcomingBaptisms = normaliseUpcomingBaptisms([
    ...state.upcomingBaptisms,
    {
      id: `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      regionId: region.id,
      eventType,
      sponsorIds,
      fillotIds,
      baptizedNames,
      dateTime,
      place: data.get("place"),
      message: data.get("message"),
      createdAt: todayIso(),
      requests: [],
    },
  ]);
  persist();
  state.upcomingSelectedEventIds = [];
  state.showUpcomingAnnouncementForm = false;
  state.upcomingAnnouncementDraft = {};
  state.upcomingConcernedIds = [];
  state.upcomingSponsorIds = [];
  renderGraph();
}

async function requestUpcomingAttendance(form) {
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const nickname = String(data.get("nickname") || "").trim();
  const selectedIds = state.upcomingSelectedEventIds.filter((eventId) => upcomingEventsForActiveRegion().some((event) => event.id === eventId));
  if (!name) {
    await showMessage("Nom requis", "Ajoute ton nom pour envoyer la demande.");
    return;
  }
  if (!selectedIds.length) {
    await showMessage("Annonce requise", "Coche au moins une annonce avant d'envoyer ta demande.");
    return;
  }

  state.upcomingBaptisms = normaliseUpcomingBaptisms(
    state.upcomingBaptisms.map((event) =>
      selectedIds.includes(event.id)
        ? {
            ...event,
            requests: [
              ...event.requests.filter((request) => normalisedText(`${request.name} ${request.nickname}`) !== normalisedText(`${name} ${nickname}`)),
              { id: `demande-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, nickname, createdAt: todayIso() },
            ],
          }
        : event
    )
  );
  state.upcomingSelectedEventIds = [];
  persist();
  renderGraph();
}

async function deleteUpcomingBaptism(eventId) {
  if (!state.adminMode) {
    await showMessage("Action bloquee", "Seul un admin peut supprimer une annonce.");
    return;
  }
  if (!await askConfirm("Supprimer l'annonce", "Supprimer cette annonce d'evenement ?", { confirmText: "Supprimer", cancelText: "Annuler", danger: true })) return;
  state.upcomingBaptisms = state.upcomingBaptisms.filter((event) => event.id !== eventId);
  persist();
  renderGraph();
}

function renderForm() {
  renderPeopleForm({
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
  });
}

function renderGenealogyTargetOptions(selected) {
  els.genealogyTargetField.hidden = Boolean(selected);
  els.genealogyTargetInput.disabled = Boolean(selected);
  const targetId = selected ? state.activeGenealogyId : formTargetGenealogy().id;
  els.genealogyTargetInput.innerHTML = state.genealogies
    .filter((genealogy) => !state.adminMode || genealogyInAdminScope(genealogy))
    .map((genealogy) => {
      const suffix = ` (${genealogyTypeLabel(genealogy)})`;
      return `<option value="${escapeHtml(genealogy.id)}">${escapeHtml(genealogy.name + suffix)}</option>`;
    })
    .join("");
  els.genealogyTargetInput.value = targetId;
}

function updatePersonSubmitLabels(selected) {
  const label = selected ? "Enregistrer" : "Creer le faluchard";
  els.savePersonButton.textContent = label;
  if (els.mobileSavePersonButton) els.mobileSavePersonButton.textContent = label;
}

function syncFormSectionsForPerson() {
  [
    "advancedInfoSection",
    "baptismInfoSection",
    "specialRelationsSection",
    "rolesStatusSection",
  ].forEach((id) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.open = false;
  });
}

function formTargetGenealogy() {
  const target =
    state.genealogies.find((genealogy) => genealogy.id === state.formTargetGenealogyId) ||
    activeGenealogy() ||
    state.genealogies[0];
  state.formTargetGenealogyId = target?.id || state.activeGenealogyId;
  return target;
}

function formPeopleForDraft() {
  const genealogy = editableSelectedPersonEntry()?.genealogy || formTargetGenealogy();
  return relationshipPeopleForGenealogy(genealogy);
}

function keepDraftPeopleInFormTarget() {
  const genealogy = editableSelectedPersonEntry()?.genealogy || formTargetGenealogy();
  const relationshipPeople = relationshipPeopleForGenealogy(genealogy);
  state.draftSponsorIds = validPersonIdsFromPeople(state.draftSponsorIds, relationshipPeople);
  state.draftHeartSponsorIds = validPersonIdsFromPeople(state.draftHeartSponsorIds, relationshipPeople);
  state.draftCeremonyEvents = state.draftCeremonyEvents.map((event) => ({
    ...event,
    sponsorIds: validPersonIdsFromPeople(event.sponsorIds, relationshipPeople),
  }));
  state.draftCrossMemberIds = validPersonIdsFromPeople(state.draftCrossMemberIds, genealogy.people);
}

function renderFillotTools() {
  const selected = getPerson(state.selectedId);
  const candidates = selected ? getFillotCandidates(selected.id) : [];
  const currentFillots = selected
    ? getClassicChildren(selected.id).filter((person) => !person.heartSponsorIds.includes(selected.id))
    : [];

  els.fillotInput.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = selected ? "Choisir un faluchard" : "Selectionner un faluchard d'abord";
  els.fillotInput.append(placeholder);

  candidates.forEach((person) => {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = displayName(person);
    els.fillotInput.append(option);
  });

  els.fillotInput.disabled = !selected || candidates.length === 0;
  els.attachFillotButton.disabled = !selected || candidates.length === 0;
  els.newFillotButton.disabled = !selected;
  renderSelectedPeople(
    els.currentFillotsList,
    currentFillots.map((person) => person.id),
    "Aucun fillot classique rattache",
    "fillot",
    state.people
  );
}

function renderRoleOptions(selectedRoles) {
  els.rolesInput.innerHTML = "";
  const formGenealogy = editableSelectedPersonEntry()?.genealogy || formTargetGenealogy();
  roleOptionsForGenealogy(formGenealogy, selectedRoles).forEach((role) => {
    const option = document.createElement("option");
    const aliases = role.aliases || [role.id];
    option.value = role.id;
    option.textContent = role.label;
    option.selected = aliases.some((roleId) => selectedRoles.includes(roleId));
    els.rolesInput.append(option);
  });
}

function renderFiliereOptions(selectedFiliere) {
  els.filiereInput.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Non renseignee";
  els.filiereInput.append(emptyOption);

  filiereStatGroups.forEach((group) => {
    const options = filiereOptionsForGroup(group.id);
    if (!options.length) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    options.forEach((filiere) => {
      const option = document.createElement("option");
      option.value = filiere.id;
      option.textContent = filiere.label;
      option.selected = selectedFiliere === filiere.id;
      optgroup.append(option);
    });
    els.filiereInput.append(optgroup);
  });

  els.filiereInput.value = selectedFiliere;
}

function renderPersonPicker(select, people, placeholderText) {
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = people.length ? placeholderText : "Aucune personne disponible";
  select.append(placeholder);

  people.forEach((person) => {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = displayName(person);
    select.append(option);
  });

  select.disabled = people.length === 0;
}

function renderSponsorSearchOptions(people) {
  els.sponsorOptions.innerHTML = joinHtml(people, (person) => `<option value="${escapeHtml(displayName(person))}"></option>`);
  els.sponsorSearchInput.disabled = people.length === 0;
  els.sponsorSearchInput.placeholder = people.length ? "Rechercher un parrain" : "Aucun parrain disponible";
}

function renderExtraCeremonyFields(people) {
  const sortedPeople = [...people].sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
  els.extraCeremonySponsorsInput.innerHTML = sortedPeople
    .map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(displayName(person))}</option>`)
    .join("");
  els.extraCeremonySponsorsInput.disabled = sortedPeople.length === 0;
  els.addExtraCeremonyButton.disabled = false;
  els.extraCeremoniesList.innerHTML = state.draftCeremonyEvents.length
    ? state.draftCeremonyEvents
        .map((event) => {
          const sponsors = event.sponsorIds.map((id) => getPersonFromPeople(people, id)).filter(Boolean);
          const removable = canRemoveDraftCeremony(event.id);
          return `<button class="chip ceremony-chip ceremony-${escapeHtml(event.type)}" type="button" ${removable ? `data-remove-extra-ceremony="${escapeHtml(event.id)}"` : "disabled"} title="${removable ? "Retirer" : "Modification reservee aux admins"}">
            ${escapeHtml(ceremonyTypeLabel(event.type))} - ${escapeHtml(event.city)}
            ${event.nickname ? `<span class="chip-note">Surnom : ${escapeHtml(event.nickname)}</span>` : ""}
            ${sponsors.length ? `<span class="chip-note">${escapeHtml(sponsors.map(displayName).join(", "))}</span>` : ""}
          </button>`;
        })
        .join("")
    : `<small>Aucune adoption ou confirmation ajoutee.</small>`;
}

function renderSelectedPeople(container, ids, emptyText, kind, people = state.people) {
  const validPeople = validPersonIdsFromPeople(ids, people)
    .map((id) => getPersonFromPeople(people, id))
    .filter(Boolean);
  if (validPeople.length === 0) {
    container.innerHTML = `<small>${escapeHtml(emptyText)}</small>`;
    return;
  }

  container.innerHTML = validPeople
    .map((person) => {
      const attr = removeAttributeForKind(kind);
      return `<button class="selected-chip" type="button" ${attr}="${escapeHtml(person.id)}" title="Retirer">${escapeHtml(displayName(person))}<span aria-hidden="true">x</span></button>`;
    })
    .join("");
}

function removeAttributeForKind(kind) {
  if (kind === "heart-sponsor") return "data-remove-heart-sponsor";
  if (kind === "cross-member") return "data-remove-cross-member";
  if (kind === "fillot") return "data-remove-fillot";
  return "data-remove-sponsor";
}

function renderCrossGroupFields(people = state.people) {
  els.crossGroupSizeInput.value = state.draftCrossGroupSize ? String(state.draftCrossGroupSize) : "";
  const maxOthers = state.draftCrossGroupSize ? state.draftCrossGroupSize - 1 : 1;
  const candidates = people
    .filter((person) => person.id !== state.selectedId)
    .filter((person) => !state.draftCrossMemberIds.includes(person.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"))
    .slice(0);

  renderPersonPicker(els.crossGroupPicker, candidates, "Choisir une personne");
  renderSelectedPeople(
    els.selectedCrossMembersList,
    state.draftCrossMemberIds,
    `Aucune personne ajoutee (${state.draftCrossMemberIds.length}/${maxOthers})`,
    "cross-member",
    people
  );
  els.addCrossMemberButton.disabled =
    els.crossGroupPicker.disabled || state.draftCrossMemberIds.length >= maxOthers;
  els.clearCrossGroupButton.disabled = state.draftCrossMemberIds.length === 0 && !state.draftCrossGroupSize;
}

function renderDetails() {
  renderPeopleDetails({
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
  });
}

function sanitisedAdminSelection() {
  return sanitiseAdminSelectionAction(state, state.people);
}

function toggleAdminSelection(shouldSelectAll) {
  toggleAdminSelectionAction(state, state.people, shouldSelectAll);
  renderAdminTools();
}

function setAdminPersonSelected(personId, isSelected) {
  if (!getPerson(personId)) return;
  setAdminPersonSelectedAction(state, personId, isSelected);
  renderAdminTools();
}

async function deleteSelectedAdminPeople() {
  const selectedIds = sanitisedAdminSelection();
  await deletePeopleByIds(selectedIds, true);
}

async function transferSelectedAdminPeople(targetGenealogyId) {
  const selectedIds = sanitisedAdminSelection();
  if (!targetGenealogyId || !selectedIds.length) return;
  await transferPeopleToGenealogy(selectedIds, targetGenealogyId, true);
}

async function promptRegionalPasswordChangeIfRequired() {
  if (!adminPasswordChangeRequired()) return true;
  const shouldContinue = await askConfirm(
    "Premiere connexion admin regional",
    "Ce compte regional doit definir un mot de passe personnel avant de gerer les fiches, familles, roles et annonces de sa region.",
    { confirmText: "Changer le mot de passe", cancelText: "Quitter admin" }
  );
  if (!shouldContinue) {
    await exitAdminMode();
    return false;
  }
  const changed = await changeRegionalAdminPassword(state.adminRegionId, { required: true });
  if (changed) return true;

  await showMessage("Acces admin ferme", "Le mot de passe regional n'a pas ete modifie. Le mode admin regional va etre quitte.");
  await exitAdminMode();
  return false;
}

async function changeRegionalAdminPassword(regionId, options = {}) {
  const isRequired = Boolean(options.required);
  const region = genealogyById(regionId);
  if (!region || !isRegionalGenealogy(region) || (isRegionalAdmin() && region.id !== state.adminRegionId)) {
    await showMessage("Action bloquee", "Tu ne peux modifier que ton propre mot de passe regional.");
    return false;
  }
  const regionInfo = adminRegionInfo(region.id);
  const canClearPassword = isGeneralAdmin() && !isRequired;
  const nextPassword = await askText("Mot de passe regional", canClearPassword
    ? `Nouveau mot de passe admin pour ${region.name}\nLaisse vide pour desactiver l'acces admin regional.`
    : `Nouveau mot de passe admin pour ${region.name}`, {
      label: "Nouveau mot de passe",
      type: "password",
      confirmText: "Enregistrer",
      required: !canClearPassword,
    });
  if (nextPassword === null) return false;
  if (!canClearPassword && !nextPassword.trim()) {
    await showMessage("Mot de passe requis", "Choisis un nouveau mot de passe avant de continuer.");
    return false;
  }

  try {
    const response = await changeRegionalPasswordRequest(region.id, nextPassword.trim(), csrfFetch);
    if (!response.ok) {
      const message = await readResponseMessage(response);
      await showMessage("Modification refusee", message || "Impossible de modifier ce mot de passe regional.");
      return false;
    }
    const payload = await response.json();
    applyAdminSession(payload.admin);
    render();
    return true;
  } catch {
    await showMessage("Serveur indisponible", "Impossible de joindre l'authentification admin.");
    return false;
  }
}

function addRegionalRole() {
  const region = roleRegionForGenealogy(activeGenealogy());
  const input = els.adminPeopleTools.querySelector("[data-admin-role-name]");
  const label = String(input?.value || "").trim();
  if (!region || !label) return;
  if (regionalRoleLabelExists(region, label)) {
    void showMessage("Role existant", "Ce role existe deja dans cette region.");
    return;
  }
  const role = { id: uniqueRegionalRoleId(label, region), label };
  state.genealogies = state.genealogies.map((genealogy) =>
    genealogy.id === region.id
      ? {
          ...genealogy,
          customRoles: mergeRoleOptions(genealogy.customRoles || [], [role]).map(({ id, label, aliases }) =>
            aliases?.length > 1 ? { id, label, aliases } : { id, label }
          ),
        }
      : genealogy
  );
  persist();
  render();
}

async function renameRegionalRole(roleId) {
  const region = roleRegionForGenealogy(activeGenealogy());
  const role = region?.customRoles?.find((item) => item.id === roleId);
  if (!region || !role) return;
  const label = await askText("Renommer le role", `Nouveau nom du role "${role.label}".`, {
    label: "Nouveau nom",
    value: role.label,
    required: true,
  });
  if (label === null) return;
  const cleanLabel = label.trim();
  if (!cleanLabel) return;
  if (regionalRoleLabelExists(region, cleanLabel, roleId)) {
    await showMessage("Role existant", "Ce role existe deja dans cette region.");
    return;
  }
  state.genealogies = state.genealogies.map((genealogy) =>
    genealogy.id === region.id
      ? {
          ...genealogy,
          customRoles: normaliseRoleOptions(genealogy.customRoles).map((item) =>
            item.id === roleId ? { ...item, label: cleanLabel } : item
          ),
        }
      : genealogy
  );
  persist();
  render();
}

async function deleteRegionalRole(roleId) {
  const region = roleRegionForGenealogy(activeGenealogy());
  const role = region?.customRoles?.find((item) => item.id === roleId);
  if (!region || !role) return;
  const confirmed = await askConfirm(
    "Supprimer le role",
    `Supprimer le role "${role.label}" de ${region.name} et des fiches concernees ?`,
    { confirmText: "Supprimer", cancelText: "Annuler", danger: true }
  );
  if (!confirmed) return;

  const deletedRoleIds = new Set([role.id, ...(role.aliases || [])]);
  const scopeIds = new Set(regionalScopeGenealogies(region).map((genealogy) => genealogy.id));
  state.genealogies = state.genealogies.map((genealogy) => {
    const next = { ...genealogy };
    if (genealogy.id === region.id) {
      next.customRoles = normaliseRoleOptions(genealogy.customRoles).filter(
        (item) => !deletedRoleIds.has(item.id) && !(item.aliases || []).some((alias) => deletedRoleIds.has(alias))
      );
      if (deletedRoleIds.has(normaliseRoleId(genealogy.cooptageRoleId))) {
        next.cooptageRoleId = defaultCooptageRoleId;
      }
    }
    if (scopeIds.has(genealogy.id)) {
      next.people = genealogy.people.map((person) => ({
        ...person,
        roles: normaliseRoles(person.roles).filter((item) => !deletedRoleIds.has(item)),
      }));
    }
    return next;
  });
  state.genealogies = withMainGenealogyPeople(state.genealogies);
  state.people = activeGenealogy().people;
  persist();
  render();
}

function regionalRoleLabelExists(region, label, exceptRoleId = "") {
  const identity = normalisedText(label);
  if (!region || !identity) return false;
  return normaliseRoleOptions(region.customRoles).some((role) => role.id !== exceptRoleId && normalisedText(role.label) === identity);
}

function uniqueRegionalRoleId(label, region) {
  const used = new Set(roleOptionsForGenealogy(region).map((role) => role.id));
  const base = normaliseRoleId(label) || "role";
  let id = base;
  let index = 2;
  while (used.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function setRegionalCooptageRole(roleId) {
  const region = roleRegionForGenealogy(activeGenealogy());
  if (!region || !genealogyInAdminScope(region)) return;
  const selected = roleOptionsForGenealogy(region, [defaultCooptageRoleId]).find(
    (role) => role.id === roleId || (role.aliases || []).includes(roleId)
  );
  if (!selected) return;
  state.genealogies = state.genealogies.map((genealogy) =>
    genealogy.id === region.id ? { ...genealogy, cooptageRoleId: selected.id } : genealogy
  );
  persist();
  render();
}

function renderAdminTools() {
  renderAdminToolsView({
    state,
    els,
    isRegionalAdmin,
    isGeneralAdmin,
    adminPasswordChangeRequired,
    genealogyInAdminScope,
    activeGenealogy,
    recentPersonEntries,
    displayName,
    roleRegionForGenealogy,
    adminRegion,
    isRegionalGenealogy,
    sanitisedAdminSelection,
    comparePeopleByFiliereAndName,
    cooptageRoleOptionForRegion,
    normaliseRoleOptions,
    roleOptionsForGenealogy,
    defaultCooptageRoleId,
    filiereLabel,
  });
}

function renderGraph() {
  renderGraphView({
    state,
    els,
    documentRef: document,
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
  });
}

function promoteFamilyGraphToRegionalScope() {
  if (state.mode !== "tree" && state.mode !== "network") return false;
  const active = activeGenealogy();
  if (!isFamilyGenealogy(active)) return false;
  const selected = getPerson(state.selectedId);
  if (!selected) return false;

  const familyId = active.id;
  const selectedKey = statPersonKey(selected);
  syncActiveGenealogy();
  const family = state.genealogies.find((genealogy) => genealogy.id === familyId);
  const region = regionalGenealogyFor(family);
  if (!family || !region) return false;

  const familyKeys = new Set(family.people.map(statPersonKey));
  const regionPerson = getPersonFromPeople(region.people, selected.id) || region.people.find((person) => statPersonKey(person) === selectedKey);
  if (!regionPerson) return false;

  const linkedPeople = uniquePeopleById([
    ...getSponsorsFromPeople(region.people, regionPerson),
    ...getChildrenFromPeople(region.people, regionPerson.id),
    ...region.people.filter((person) => regionPerson.crossGroupId && person.crossGroupId === regionPerson.crossGroupId),
  ]).filter((person) => person.id !== regionPerson.id);
  const hasExternalFamilyLink = linkedPeople.some((person) => !familyKeys.has(statPersonKey(person)));
  if (!hasExternalFamilyLink) return false;

  state.activeGenealogyId = region.id;
  state.people = region.people;
  state.formTargetGenealogyId = region.id;
  state.selectedId = regionPerson.id;
  resetFormDraft();
  persistLocal();
  return true;
}

function renderTree(person) {
  renderTreeView({
    els,
    person,
    ancestorDepth: state.ancestorDepth,
    descendantDepth: state.descendantDepth,
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
    documentRef: document,
  });
}

function renderNetwork(person) {
  renderNetworkView({
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
    documentRef: document,
  });
}

function applyGraphZoom() {
  const canvas = els.graphStage.querySelector(".graph-canvas");
  if (!canvas) return;
  canvas.style.transform = `scale(${state.graphZoom})`;
  els.zoomResetButton.textContent = `${Math.round(state.graphZoom * 100)}%`;
}

function centerMobileNetworkOnPerson(personId) {
  if (!isSmartphoneViewport()) return;
  window.requestAnimationFrame(() => {
    const node = [...els.graphStage.querySelectorAll(".network-node")].find((item) => item.dataset.personId === personId);
    if (!node) return;
    const centerX = node.offsetLeft + node.offsetWidth / 2;
    const centerY = node.offsetTop + node.offsetHeight / 2;
    els.graphStage.scrollLeft = Math.max(0, centerX - els.graphStage.clientWidth / 2);
    els.graphStage.scrollTop = Math.max(0, centerY - els.graphStage.clientHeight / 2);
  });
}

function relationshipLegend() {
  return createRelationshipLegend({ documentRef: document });
}

function renderOverview() {
  renderOverviewView({
    state,
    els,
    sortedEntriesByFiliere,
    deduplicatedStatEntries,
    overviewGroupsByFiliere,
    nodeCard,
    escapeHtml,
    applyGraphZoom,
    documentRef: document,
  });
}

function renderNewcomers() {
  renderNewcomersView({
    state,
    els,
    latestNewcomers,
    personCardHtml,
    render,
  });
}

function personCardHtml(person) {
  return graphPersonCardHtml({ person, filiereStyleAttr, nodeInfoHtml });
}

function baptismTimelineData() {
  const entries = baptismTimelineEntries();
  const period = state.baptismTimelinePeriod;
  const selectedMonthKey = entries.length ? selectedBaptismMonthKey(entries) : "";
  const series = baptismTimelineSeries(entries, period);
  const scope = statsScopeLabel();
  const periodLabel = period === "month" && selectedMonthKey ? `mois de ${baptismMonthLabel(selectedMonthKey)}` : "par annee";
  return { entries, period, selectedMonthKey, series, scope, periodLabel };
}

function baptismTimelineViewHtml(timeline = baptismTimelineData()) {
  const { entries, series, period } = timeline;
  if (!entries.length) {
    return `<div class="timeline-view">
      ${baptismTimelineControls(entries)}
      <div class="empty-state compact-empty">Aucune date de bapteme renseignee pour cette vue.</div>
    </div>`;
  }

  return `<div class="timeline-view">
    ${baptismTimelineControls(entries)}
    ${baptismTimelineSvg(series, period)}
    ${baptismTimelineSummary(entries, series)}
    ${baptismTimelinePeriodList(series, period)}
  </div>`;
}

function baptismTimelineControls(entries) {
  const monthPicker =
    state.baptismTimelinePeriod === "month" && entries.length
      ? `<div class="timeline-month-controls">
          <button type="button" data-baptism-month-step="-1" title="Mois precedent">&lt;</button>
          <select data-baptism-month-select aria-label="Mois affiche">
            ${baptismMonthOptions(entries)
              .map(
                (option) =>
                  `<option value="${escapeHtml(option.key)}" ${option.key === selectedBaptismMonthKey(entries) ? "selected" : ""}>${escapeHtml(option.label)}</option>`
              )
              .join("")}
          </select>
          <button type="button" data-baptism-month-step="1" title="Mois suivant">&gt;</button>
        </div>`
      : "";
  return `<div class="timeline-controls" role="tablist" aria-label="Granularite de la courbe des baptemes">
    <button class="${state.baptismTimelinePeriod === "month" ? "is-active" : ""}" type="button" data-baptism-period="month">Mois</button>
    <button class="${state.baptismTimelinePeriod === "year" ? "is-active" : ""}" type="button" data-baptism-period="year">Annees</button>
  </div>${monthPicker}`;
}

function bindBaptismTimelineControls() {
  els.graphStage.querySelectorAll("[data-baptism-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.baptismTimelinePeriod = button.dataset.baptismPeriod === "year" ? "year" : "month";
      refreshBaptismTimelineSurface();
    });
  });
  const monthSelect = els.graphStage.querySelector("[data-baptism-month-select]");
  if (monthSelect) {
    monthSelect.addEventListener("change", () => {
      state.baptismTimelineMonthKey = monthSelect.value;
      refreshBaptismTimelineSurface();
    });
  }
  els.graphStage.querySelectorAll("[data-baptism-month-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const entries = baptismTimelineEntries();
      const options = baptismMonthOptions(entries);
      const currentIndex = options.findIndex((option) => option.key === selectedBaptismMonthKey(entries));
      const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + Number(button.dataset.baptismMonthStep)));
      state.baptismTimelineMonthKey = options[nextIndex]?.key || state.baptismTimelineMonthKey;
      refreshBaptismTimelineSurface();
    });
  });
}

function refreshBaptismTimelineSurface() {
  renderStats();
}

function baptismTimelineEntries() {
  const entries = deduplicatedStatEntries(currentStatsGenealogies());
  return entries
    .map(({ person, genealogy }) => ({ person, genealogy, date: parseDate(person.baptismDate || "") }))
    .filter(({ date }) => !Number.isNaN(date.getTime()) && date <= today())
    .sort(
      (a, b) =>
        a.date - b.date ||
        displayName(a.person).localeCompare(displayName(b.person), "fr") ||
        a.genealogy.name.localeCompare(b.genealogy.name, "fr")
    );
}

function baptismTimelineSeries(entries, period) {
  if (!entries.length) return [];
  if (period === "month") return baptismTimelineMonthSeries(entries, selectedBaptismMonthKey(entries));

  const counts = new Map();
  entries.forEach((entry) => {
    const key = baptismYearKey(entry.date);
    const bucket = counts.get(key) || { count: 0, entries: [] };
    bucket.count += 1;
    bucket.entries.push(entry);
    counts.set(key, bucket);
  });

  const series = [];
  let cursor = new Date(entries[0].date.getFullYear(), 0, 1);
  const end = new Date(entries[entries.length - 1].date.getFullYear(), 0, 1);
  while (cursor <= end) {
    const key = baptismYearKey(cursor);
    const bucket = counts.get(key) || { count: 0, entries: [] };
    series.push({
      key,
      date: new Date(cursor),
      label: baptismYearLabel(cursor),
      count: bucket.count,
      entries: bucket.entries,
    });
    cursor = new Date(cursor.getFullYear() + 1, 0, 1);
  }
  return series;
}

function baptismTimelineMonthSeries(entries, monthKey) {
  const monthDate = dateFromMonthKey(monthKey);
  if (!monthDate) return [];
  const counts = new Map();
  entries
    .filter((entry) => baptismMonthKey(entry.date) === monthKey)
    .forEach((entry) => {
      const key = baptismDayKey(entry.date);
      const bucket = counts.get(key) || { count: 0, entries: [] };
      bucket.count += 1;
      bucket.entries.push(entry);
      counts.set(key, bucket);
    });

  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1);
    const key = baptismDayKey(date);
    const bucket = counts.get(key) || { count: 0, entries: [] };
    return {
      key,
      date,
      label: String(index + 1),
      tooltipLabel: formatShortDate(date),
      count: bucket.count,
      entries: bucket.entries,
    };
  });
}

function baptismTimelineSvg(series, period) {
  const width = 980;
  const height = 360;
  const left = 78;
  const right = 26;
  const top = 28;
  const bottom = 74;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...series.map((item) => item.count), 1);
  const points = series.map((item, index) => {
    const x = left + (series.length === 1 ? plotWidth / 2 : (index * plotWidth) / (series.length - 1));
    const y = top + plotHeight - (item.count / maxValue) * plotHeight;
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)} ${top + plotHeight} L${points[0].x.toFixed(1)} ${top + plotHeight} Z`;
  const yTicks = timelineTickValues(maxValue);
  const xLabels = timelineXAxisLabels(points);

  const xAxisLabel = period === "month" ? "Jours du mois" : "Annees";
  return `<section class="timeline-card">
    <svg class="timeline-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Courbe du nombre de baptemes par ${period === "month" ? "jour" : "annee"}">
      <g class="timeline-grid">
        ${yTicks
          .map((value) => {
            const y = top + plotHeight - (value / maxValue) * plotHeight;
            return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}"></line><text x="${left - 12}" y="${(y + 4).toFixed(1)}">${value}</text>`;
          })
          .join("")}
        ${xLabels
          .map((point) => `<line x1="${point.x.toFixed(1)}" y1="${top}" x2="${point.x.toFixed(1)}" y2="${top + plotHeight}"></line>`)
          .join("")}
      </g>
      <path class="timeline-area" d="${areaPath}"></path>
      <path class="timeline-line" d="${path}"></path>
      <g class="timeline-points">
        ${points
          .filter((point) => point.count > 0)
          .map((point) => timelinePointHtml(point, width, right, left, top))
          .join("")}
      </g>
      <g class="timeline-axis">
        <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}"></line>
        <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}"></line>
        ${xLabels
          .map((point) => `<text x="${point.x.toFixed(1)}" y="${height - 20}">${escapeHtml(point.label)}</text>`)
          .join("")}
        <text class="timeline-axis-label timeline-y-label" transform="rotate(-90)" x="${-(top + plotHeight / 2).toFixed(1)}" y="18">Nombre de baptemes</text>
        <text class="timeline-axis-label timeline-x-label" x="${(left + plotWidth / 2).toFixed(1)}" y="${height - 4}">${xAxisLabel}</text>
        <text class="timeline-caption" x="${width - right}" y="${top + 14}">nombre de baptemes</text>
      </g>
    </svg>
  </section>`;
}

function timelinePointHtml(point, width, right, left, top) {
  const tooltipWidth = 156;
  const tooltipHeight = 44;
  const tooltipX = Math.max(left, Math.min(width - right - tooltipWidth, point.x + 12));
  const tooltipY = point.y < top + tooltipHeight + 12 ? point.y + 14 : point.y - tooltipHeight - 12;
  const label = `${point.tooltipLabel || point.label} - ${point.count} bapteme(s)`;
  return `<g class="timeline-point" tabindex="0" aria-label="${escapeHtml(label)}">
    <circle class="timeline-point-hit" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="13"></circle>
    <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4.8"></circle>
    <g class="timeline-point-tooltip" transform="translate(${tooltipX.toFixed(1)} ${tooltipY.toFixed(1)})">
      <rect width="${tooltipWidth}" height="${tooltipHeight}" rx="8"></rect>
      <text x="10" y="17">${escapeHtml(point.tooltipLabel || point.label)}</text>
      <text class="timeline-tooltip-count" x="10" y="34">${point.count} bapteme(s)</text>
    </g>
  </g>`;
}

function baptismTimelineSummary(entries, series) {
  const busiest = series
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.date - b.date)[0];
  const displayedTotal = series.reduce((total, item) => total + item.count, 0);
  return `<div class="timeline-summary">
    <div><span>Axe vertical</span><strong>Nombre de baptemes</strong></div>
    <div><span>Total affiche</span><strong>${displayedTotal}</strong></div>
    <div><span>Total enregistre</span><strong>${entries.length}</strong></div>
    <div><span>Periode la plus dense</span><strong>${busiest ? `${escapeHtml(busiest.tooltipLabel || busiest.label)} (${busiest.count})` : "Aucune"}</strong></div>
  </div>`;
}

function baptismTimelinePeriodList(series, period) {
  const rows = series
    .filter((item) => item.count > 0)
    .slice()
    .reverse()
    .map((item) => {
      const people = item.entries
        .map(({ person }) => displayName(person))
        .sort((a, b) => a.localeCompare(b, "fr"))
        .join(", ");
      return `<li><span>${escapeHtml(item.tooltipLabel || item.label)}</span><strong>${item.count}</strong><small>${escapeHtml(people)}</small></li>`;
    })
    .join("");
  return `<section class="timeline-periods">
    <h3>Baptemes par ${period === "month" ? "jour" : "annee"}</h3>
    <ul>${rows}</ul>
  </section>`;
}

function baptismMonthOptions(entries) {
  const seen = new Set();
  return entries
    .map((entry) => {
      const key = baptismMonthKey(entry.date);
      if (seen.has(key)) return null;
      seen.add(key);
      return { key, label: baptismMonthLabel(key), date: new Date(entry.date.getFullYear(), entry.date.getMonth(), 1) };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

function selectedBaptismMonthKey(entries) {
  const options = baptismMonthOptions(entries);
  if (!options.length) return "";
  if (!options.some((option) => option.key === state.baptismTimelineMonthKey)) {
    state.baptismTimelineMonthKey = options[options.length - 1].key;
  }
  return state.baptismTimelineMonthKey;
}

function baptismMonthKey(date) {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function baptismDayKey(date) {
  return `${baptismMonthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function baptismYearKey(date) {
  return String(date.getFullYear());
}

function baptismYearLabel(date) {
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric" }).format(date);
}

function baptismMonthLabel(key) {
  const date = dateFromMonthKey(key);
  return date ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date) : "mois inconnu";
}

function dateFromMonthKey(key) {
  const [year, month] = String(key || "").split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function renderStats() {
  renderStatsView({
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
  });
}

function filiereStatsHtml(stats) {
  return renderFiliereStatsHtml({
    stats,
    expandedStatKey: state.expandedStatKey,
    filiereStatGroups,
    filiereOptionsForGroup,
    filiereSwatchHtml,
    renderFilierePeopleDetails,
  });
}

function roleStatsHtml(stats) {
  return renderRoleStatsHtml({
    stats,
    expandedStatKey: state.expandedStatKey,
    renderStatPeopleChips,
  });
}

function filiereStatsGroupRow(group, stats) {
  return renderFiliereStatsGroupRow({ group, stats, filiereOptionsForGroup, filiereSwatchHtml });
}

function statToggleAttrs(key, isExpanded) {
  return statToggleAttrsFeature(key, isExpanded);
}

function toggleStatCard(event) {
  if (event.target.closest("[data-stat-person-id]")) return;
  const card = event.currentTarget;
  const key = card.dataset.statToggle;
  state.expandedStatKey = state.expandedStatKey === key ? null : key;
  renderStats();
}

function largestDescendantStatCard(stats) {
  return renderLargestDescendantStatCard({
    stats,
    expandedStatKey: state.expandedStatKey,
    getDescendantsByDepthFromPeople,
    flattenGroups,
    renderStatPeopleChips,
  });
}

function topSongStatCard(stats) {
  return renderTopSongStatCard({ stats, expandedStatKey: state.expandedStatKey, renderStatPeopleChips });
}

function longestNicknameStatCard(stats) {
  return renderLongestNicknameStatCard({ stats, expandedStatKey: state.expandedStatKey, renderStatPeopleChips });
}

function crossGroupsStatCard(stats) {
  return renderCrossGroupsStatCard({
    stats,
    expandedStatKey: state.expandedStatKey,
    renderCrossGroupDetails,
  });
}

function roleStatCard(title, role, stats) {
  return renderRoleStatCard({
    title,
    role,
    stats,
    expandedStatKey: state.expandedStatKey,
    renderStatPeopleChips,
  });
}

function renderStatPeopleChips(entries, emptyText) {
  return renderStatPeopleChipsFeature({ entries, emptyText, showGenealogy: state.genealogies.length > 1 });
}

function renderCrossGroupDetails(groups) {
  return renderCrossGroupDetailsFeature({ groups, renderStatPeopleChips });
}

function renderFilierePeopleDetails(stats) {
  return renderFilierePeopleDetailsFeature({
    stats,
    filiereStatGroups,
    filiereOptionsForGroup,
    renderStatPeopleChips,
  });
}

function generation(people, emptyText, focus = false, label = "") {
  return createGenerationBand({ people, emptyText, focus, label, nodeCard, documentRef: document });
}

function relationshipGeneration(links, emptyText, label = "") {
  return createRelationshipGenerationBand({ links, emptyText, label, nodeCard, documentRef: document });
}

function focusGroup(person) {
  const members = uniquePeopleById([person, ...getCrossGroupMembers(person.id)]);
  return members.length > 1 ? members : [person];
}

function focusGroupLabel(person) {
  return focusGroup(person).length > 1 ? "Bapteme croise recherche" : "Faluchard recherche";
}

function connector() {
  return createConnector({ documentRef: document });
}

function nodeCard(person, focus = false, genealogyId = "", contextLabel = "") {
  return createGraphNodeCard({
    person,
    focus,
    genealogyId,
    contextLabel,
    resolveGenealogyId: genealogyIdForRelatedPerson,
    filiereStrip,
    nodeInfoHtml,
    onSelectDifferentGenealogy: (cardGenealogyId, personId) => {
      if (cardGenealogyId === state.activeGenealogyId) return false;
      selectPersonFromGenealogy(cardGenealogyId, personId);
      return true;
    },
    onSelectSameGenealogy: (cardGenealogyId, personId) => {
      state.selectedId = personId;
      rememberRecentPerson(cardGenealogyId, personId);
      render();
    },
    documentRef: document,
  });
}

function genealogyIdForRelatedPerson(personId) {
  if (getPerson(personId)) return state.activeGenealogyId;
  const main = mainGenealogy();
  return main && getPersonFromPeople(main.people, personId) ? main.id : state.activeGenealogyId;
}

function nodeInfoHtml(person, contextLabel = "") {
  return graphNodeInfoHtml({
    person,
    contextLabel,
    renderRoleBadges,
    filiereLabel,
    compactLine,
    crossGroupDetail,
    formatCeremonyDate,
    ceremonyEventsText,
  });
}

function nodeCardClass(person, focus = false) {
  return graphNodeCardClass(person, focus);
}

function edge(from, to, kind = "sponsor") {
  const geometry = edgeGeometry(from, to, { hasArrow: kind !== "cross" });
  const line = document.createElement("div");
  line.className = `network-edge edge-${kind}`;
  line.style.left = `${geometry.x}px`;
  line.style.top = `${geometry.y}px`;
  line.style.width = `${geometry.length}px`;
  line.style.transform = `rotate(${geometry.angle}deg)`;
  return line;
}

function peopleIndexFor(people = state.people) {
  return createPeopleIndex(people, { cache: peopleIndexCache, displayName });
}

function peopleSearchRowsFor(people = state.people) {
  return createPeopleSearchRows(people, {
    cache: peopleSearchCache,
    peopleIndexFor,
    roleLabels,
    filiereLabel,
    ceremonyLabel,
    formatCeremonyDate,
    ceremonyEventsText,
    crossGroupSummary,
  });
}

function filteredPeople() {
  const index = peopleIndexFor(state.people);
  if (!state.query) return [...index.sortedByDisplayName];
  return peopleSearchRowsFor(state.people).filter((entry) => entry.text.includes(state.query)).map((entry) => entry.person);
}

function getPerson(id) {
  return peopleIndexFor(state.people).byId.get(id) ?? null;
}

function graphPerson(id) {
  return getPerson(id) || relatedPerson(id);
}

function getSponsors(person) {
  return person.sponsorIds.map(relatedPerson).filter(Boolean);
}

function getHeartSponsors(person) {
  return person.heartSponsorIds.map(relatedPerson).filter(Boolean);
}

function getChildren(id) {
  return uniquePeopleById([...(peopleIndexFor(state.people).childrenBySponsorId.get(id) || [])]);
}

function childRelationshipLinks(sponsorId) {
  const links = [];
  getClassicChildren(sponsorId).forEach((person) => {
    links.push({
      id: person.id,
      person,
      kind: person.heartSponsorIds.includes(sponsorId) ? "heart" : "sponsor",
      label: person.heartSponsorIds.includes(sponsorId) ? "Fillot de coeur" : "Fillot",
    });
  });
  getCeremonyChildren(sponsorId).forEach((person) => {
    const ceremony = normaliseCeremonyEvents(person.ceremonyEvents).find((event) => event.sponsorIds.includes(sponsorId));
    if (!ceremony) return;
    const existing = links.find((link) => link.id === person.id);
    const label = ceremony.type === "confirmation" ? "Fillot de confirmation" : "Fillot d'adoption";
    if (existing) {
      existing.kind = ceremony.type;
      existing.label = label;
      existing.event = ceremony;
      return;
    }
    links.push({ id: person.id, person, kind: ceremony.type, label, event: ceremony });
  });
  return links;
}

function getClassicChildren(id) {
  return uniquePeopleById([...(peopleIndexFor(state.people).classicChildrenBySponsorId.get(id) || [])]);
}

function getCeremonyChildren(id) {
  return uniquePeopleById([...(peopleIndexFor(state.people).ceremonyChildrenBySponsorId.get(id) || [])]);
}

function getLineageSponsors(person) {
  return uniquePeopleById(lineageSponsorLinks(person).map((link) => link.person));
}

function lineageSponsorLinks(person, people = relationshipPeopleForGenealogy(activeGenealogy())) {
  const byId = new Map();
  (person.sponsorIds || []).forEach((sponsorId) => {
    const sponsor = getPersonFromPeople(people, sponsorId);
    if (!sponsor) return;
    byId.set(sponsorId, {
      id: sponsorId,
      person: sponsor,
      kind: (person.heartSponsorIds || []).includes(sponsorId) ? "heart" : "sponsor",
      label: (person.heartSponsorIds || []).includes(sponsorId) ? "Parrain de coeur" : "Parrain",
    });
  });
  normaliseCeremonyEvents(person.ceremonyEvents).forEach((ceremony) => {
    ceremony.sponsorIds.forEach((sponsorId) => {
      const sponsor = getPersonFromPeople(people, sponsorId);
      if (!sponsor) return;
      byId.set(sponsorId, {
        id: sponsorId,
        person: sponsor,
        kind: ceremony.type,
        label: ceremonyTypeLabel(ceremony.type),
        event: ceremony,
      });
    });
  });
  return [...byId.values()];
}

function ceremonySponsorLinks(person, people = relationshipPeopleForGenealogy(activeGenealogy())) {
  return normaliseCeremonyEvents(person?.ceremonyEvents)
    .flatMap((ceremony) =>
      ceremony.sponsorIds
        .map((sponsorId) => {
          const sponsor = getPersonFromPeople(people, sponsorId);
          return sponsor ? { id: sponsorId, person: sponsor, kind: ceremony.type, event: ceremony } : null;
        })
        .filter(Boolean)
    );
}

function getCrossGroupMembers(id) {
  const person = getPerson(id);
  if (!person?.crossGroupId) return [];
  return [...(peopleIndexFor(state.people).crossGroupById.get(person.crossGroupId) || [])]
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
}

function uniquePeopleById(people) {
  return uniquePeopleByIdFeature(people);
}

function getFillotCandidates(sponsorId) {
  const existingChildren = new Set(getClassicChildren(sponsorId).map((person) => person.id));
  const ancestors = new Set(flattenGroups(getAncestorsByDepth(sponsorId)).map((person) => person.id));

  return state.people
    .filter((person) => person.id !== sponsorId)
    .filter((person) => !existingChildren.has(person.id))
    .filter((person) => !ancestors.has(person.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "fr"));
}

function getAncestorsByDepth(id) {
  const start = getPerson(id);
  if (!start) return [];
  return walkByDepth([start], (person) => getLineageSponsors(person), id);
}

function getDescendantsByDepth(id) {
  const start = getPerson(id);
  if (!start) return [];
  return walkByDepth([start], (person) => getChildren(person.id), id);
}

function getAncestorsByDepthFromPeople(people, id) {
  const start = getPersonFromPeople(people, id);
  if (!start) return [];
  return walkByDepth([start], (person) => getSponsorsFromPeople(people, person), id);
}

function getDescendantsByDepthFromPeople(people, id) {
  const start = getPersonFromPeople(people, id);
  if (!start) return [];
  return walkByDepth([start], (person) => getChildrenFromPeople(people, person.id), id);
}

function getPersonFromPeople(people, id) {
  return getPersonFromPeopleFeature(people, id, { peopleIndexFor });
}

function getChildrenFromPeople(people, id) {
  return uniquePeopleById([...(peopleIndexFor(people).childrenBySponsorId.get(id) || [])]);
}

function getSponsorsFromPeople(people, person) {
  return uniquePeopleById(lineageSponsorLinks(person, people).map((link) => link.person));
}

function allPeopleEntries(genealogies = genealogiesForGlobalStats()) {
  return genealogies.flatMap((genealogy) =>
    genealogy.people.map((person) => ({ person, genealogy }))
  );
}

function sortedEntriesByFiliere(entries) {
  return [...entries].sort(
    (a, b) =>
      filiereSortIndex(a.person.filiere) - filiereSortIndex(b.person.filiere) ||
      displayName(a.person).localeCompare(displayName(b.person), "fr") ||
      a.genealogy.name.localeCompare(b.genealogy.name, "fr")
  );
}

function comparePeopleByFiliereAndName(a, b) {
  return (
    filiereSortIndex(a.filiere) - filiereSortIndex(b.filiere) ||
    compareByFrenchLabel(displayName(a), displayName(b))
  );
}

function overviewGroupsByFiliere(entries) {
  const groups = filiereOptions
    .map((option) => ({
      label: option.label,
      entries: entries.filter(({ person }) => person.filiere === option.id),
    }))
    .filter((group) => group.entries.length);
  const unknownEntries = entries.filter(({ person }) => !person.filiere);
  if (unknownEntries.length) groups.push({ label: "Non renseignee", entries: unknownEntries });
  return groups;
}

function filiereSortIndex(id) {
  const index = filiereOptions.findIndex((option) => option.id === id);
  return index === -1 ? filiereOptions.length : index;
}

function deduplicatedStatEntries(genealogies = genealogiesForGlobalStats()) {
  const bestByPerson = new Map();
  allPeopleEntries(genealogies).forEach((entry) => {
    const key = statPersonKey(entry.person);
    const current = bestByPerson.get(key);
    if (!current || compareStatSource(entry, current) < 0) {
      bestByPerson.set(key, entry);
    }
  });
  return [...bestByPerson.values()].sort(compareStatPeople);
}

function genealogyStats() {
  const statsGenealogies = currentStatsGenealogies();
  const roleOptionList = roleOptionsForStatsScope(statsGenealogies);
  const canonicalRoleIds = new Map(
    roleOptionList.flatMap((role) => (role.aliases || [role.id]).map((roleId) => [roleId, role.id]))
  );
  const roleCounts = Object.fromEntries(roleOptionList.map((role) => [role.id, 0]));
  const rolePeople = Object.fromEntries(roleOptionList.map((role) => [role.id, []]));
  const filiereCounts = Object.fromEntries(filiereOptions.map((item) => [item.id, 0]));
  const filierePeople = Object.fromEntries(filiereOptions.map((item) => [item.id, []]));
  const unknownFilierePeople = [];
  let unknownFiliereCount = 0;
  const songCounts = new Map();
  const crossGroups = new Map();
  const descendantScores = [];
  const nicknameScores = [];
  let unbaptizedCount = 0;
  let baptizedCount = 0;
  const statEntries = deduplicatedStatEntries(statsGenealogies);
  const totalPeople = statEntries.length;

  statEntries.forEach(({ person, genealogy }) => {
    const entry = { person, genealogy };
    normaliseRoles(person.roles).forEach((role) => {
      const canonicalRole = canonicalRoleIds.get(role) || role;
      if (!rolePeople[canonicalRole]) rolePeople[canonicalRole] = [];
      if (!Number.isFinite(roleCounts[canonicalRole])) roleCounts[canonicalRole] = 0;
      roleCounts[canonicalRole] += 1;
      rolePeople[canonicalRole].push(entry);
    });
    if (person.filiere) {
      filiereCounts[person.filiere] += 1;
      filierePeople[person.filiere].push(entry);
    } else {
      unknownFiliereCount += 1;
      unknownFilierePeople.push(entry);
    }
    if (person.song) {
      const song = songCounts.get(person.song) || { name: person.song, count: 0, people: [] };
      song.count += 1;
      song.people.push(entry);
      songCounts.set(person.song, song);
    }
    if (person.crossGroupId) {
      const key = `${genealogy.id}:${person.crossGroupId}`;
      const group = crossGroups.get(key) || { genealogy, people: [] };
      group.people.push(entry);
      crossGroups.set(key, group);
    }
    normaliseNicknames(person.nicknames, person.nickname).forEach((nickname) => {
      nicknameScores.push({
        nickname,
        length: nickname.length,
        person,
        genealogy,
      });
    });
    if (!person.baptismDate && person.baptismStatus === "unbaptized") unbaptizedCount += 1;
    if (person.baptismDate && parseDate(person.baptismDate) <= today()) baptizedCount += 1;

    descendantScores.push({
      person,
      genealogy,
      count: uniquePeopleByStatIdentity(flattenGroups(getDescendantsByDepthFromPeople(genealogy.people, person.id))).length,
    });
  });

  Object.values(rolePeople).forEach((people) => people.sort(compareStatPeople));
  Object.values(filierePeople).forEach((people) => people.sort(compareStatPeople));
  unknownFilierePeople.sort(compareStatPeople);
  songCounts.forEach((song) => song.people.sort(compareStatPeople));
  const crossGroupList = [...crossGroups.values()]
    .map((group) => ({ ...group, people: group.people.sort(compareStatPeople) }))
    .sort(
      (a, b) =>
        a.genealogy.name.localeCompare(b.genealogy.name, "fr") ||
        displayName(a.people[0]?.person || { name: "" }).localeCompare(
          displayName(b.people[0]?.person || { name: "" }),
          "fr"
        )
    );

  const largestDescendant = descendantScores
    .sort((a, b) => b.count - a.count || displayName(a.person).localeCompare(displayName(b.person), "fr"))[0];

  const topSong = [...songCounts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"))[0];
  const longestNickname = nicknameStats(nicknameScores);

  return {
    totalPeople,
    genealogyCount: statsGenealogies.length,
    roleOptions: roleOptionList,
    roleCounts,
    rolePeople,
    filiereCounts,
    filierePeople,
    unknownFiliereCount,
    unknownFilierePeople,
    topSong,
    longestNickname,
    largestDescendant,
    crossGroups: crossGroupList,
    crossGroupCount: crossGroupList.length,
    unbaptizedCount,
    baptizedCount,
  };
}

function graphRings(person, ancestorDepth = state.ancestorDepth, descendantDepth = state.descendantDepth) {
  const ancestorGroups = limitedGroups(getAncestorsByDepth(person.id), ancestorDepth)
    .map((people, index) => ({ people, depth: index + 1 }))
    .reverse();
  const descendantGroups = limitedGroups(getDescendantsByDepth(person.id), descendantDepth).map((people, index) => ({
    people,
    depth: index + 1,
  }));

  return buildGraphRings({
    person,
    ancestorGroups,
    descendantGroups,
  });
}

function latestNewcomers() {
  return [...state.people]
    .filter((person) => normaliseCeremonyType(person.ceremonyType) === "bapteme")
    .filter((person) => personBaptismTime(person) > 0)
    .sort((a, b) => personBaptismTime(b) - personBaptismTime(a))
    .slice(0, 10)
    .reverse();
}

function personBaptismTime(person) {
  const date = parseDate(person.baptismDate || "");
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function ancestorLabel(depth) {
  if (depth === 1) return "Parrains";
  if (depth === 2) return "Grands-parrains";
  return `Ascendance niveau ${depth}`;
}

function descendantLabel(depth) {
  if (depth === 1) return "Fillots";
  if (depth === 2) return "Petits-fillots";
  return `Descendance niveau ${depth}`;
}

function renderChips(people, emptyText) {
  if (people.length === 0) return `<small>${escapeHtml(emptyText)}</small>`;
  return people
    .map((person) => `<button class="chip" type="button" data-person-id="${escapeHtml(person.id)}">${escapeHtml(displayName(person))}</button>`)
    .join("");
}

function renderRoleBadges(roles, emptyText = "") {
  const validRoles = canonicaliseRoleIds(roles);
  if (!validRoles.length) return emptyText ? `<small>${escapeHtml(emptyText)}</small>` : "";
  return `<span class="badge-line">${validRoles
    .map((role) => `<span class="role-badge role-${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</span>`)
    .join("")}</span>`;
}

function roleLabels(roles) {
  return canonicaliseRoleIds(roles).map(roleLabel);
}

function roleLabel(roleId) {
  const role = allRoleOptions().find((item) => item.id === roleId || item.aliases?.includes(roleId));
  return role?.label || roleLabelFromId(roleId);
}

function roleLabelFromId(roleId) {
  return labelFromId(roleId);
}

function renderSponsorChips(person, emptyText) {
  const sponsors = getSponsors(person);
  if (sponsors.length === 0) return `<small>${escapeHtml(emptyText)}</small>`;
  return sponsors
    .map((sponsor) => {
      const isHeart = person.heartSponsorIds.includes(sponsor.id);
      const note = isHeart ? `<span class="chip-note">Parrain de coeur</span>` : "";
      const className = isHeart ? "chip heart-chip" : "chip";
      return `<button class="${className}" type="button" data-person-id="${escapeHtml(sponsor.id)}">${escapeHtml(displayName(sponsor))}${note}</button>`;
    })
    .join("");
}

function renderCeremonySponsorChips(person, emptyText) {
  const links = ceremonySponsorLinks(person);
  if (!links.length) return `<small>${escapeHtml(emptyText)}</small>`;
  return links
    .map(({ person: sponsor, kind, event }) => {
      const nickname = event.nickname ? ` - Surnom : ${escapeHtml(event.nickname)}` : "";
      const note = `<span class="chip-note">${escapeHtml(ceremonyTypeLabel(kind))}${event.city ? ` - ${escapeHtml(event.city)}` : ""}${nickname}</span>`;
      return `<button class="chip ceremony-chip ceremony-${escapeHtml(kind)}" type="button" data-person-id="${escapeHtml(sponsor.id)}">${escapeHtml(displayName(sponsor))}${note}</button>`;
    })
    .join("");
}

function ceremonyEventsText(person) {
  const events = normaliseCeremonyEvents(person?.ceremonyEvents);
  if (!events.length) return "Aucune";
  return events
    .map((event) => {
      const sponsors = event.sponsorIds.map(relatedPerson).filter(Boolean).map(displayName);
      const label = ceremonyTypeLabel(event.type);
      return `${label} a ${event.city}${event.nickname ? ` - Surnom : ${event.nickname}` : ""}${sponsors.length ? ` - P/M : ${sponsors.join(", ")}` : ""}`;
    })
    .join(" ; ");
}

function ceremonyTypeLabel(type) {
  return type === "confirmation" ? "Confirmation" : "Adoption";
}

function formatCeremonyDate(person, includePlannedDate = false) {
  const value = person?.baptismDate || "";
  const status = normaliseBaptismStatus(person?.baptismStatus);
  if (!value) {
    return status === "unbaptized" ? "Pas encore baptise" : "Date de bapteme inconnue";
  }
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "Date invalide";
  const formatted = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
  if (date > today()) {
    return includePlannedDate ? `Non baptis\u00e9 - prevu le ${formatted}` : "Non baptis\u00e9";
  }
  return `Bapteme - ${formatted}`;
}

function ceremonyLabel(value) {
  return labelFromMap(uiLabels.ceremony, normaliseCeremonyType(value), uiLabels.ceremony.bapteme);
}

function crossGroupSummary(person) {
  const members = getCrossGroupMembers(person.id);
  if (members.length < 2) return "Aucun";
  const others = members.filter((member) => member.id !== person.id).map(displayName).join(", ");
  return `Croisee a ${members.length} personnes avec ${others}`;
}

function crossGroupDetail(person) {
  const members = getCrossGroupMembers(person.id);
  if (members.length < 2) return "";
  const others = members.filter((member) => member.id !== person.id).map(displayName);
  return others.length
    ? `Bapteme croise avec ${others.join(", ")}`
    : "Bapteme croise : groupe incomplet";
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function today() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const t = midnight.getTime();
  if (_todayCache?.t !== t) _todayCache = { t, d: new Date(t) };
  return _todayCache.d;
}

function uniqueNames(names) {
  const byName = new Map();
  names.forEach((name) => {
    const cleanName = String(name || "").trim().replace(/\s+/g, " ");
    if (cleanName) byName.set(normalisedText(cleanName), cleanName);
  });
  return [...byName.values()];
}

function validPersonIdsFromPeople(ids, people) {
  return uniqueIds(ids).filter((id) => getPersonFromPeople(people, id));
}

function uniqueGenealogyId(name) {
  return uniqueGenealogyIdFrom(makeId(name), new Set(state.genealogies.map((item) => item.id)));
}

function uniqueGenealogyIdFrom(base, seen) {
  let id = base || "genealogie";
  let index = 2;
  while (seen.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  seen.add(id);
  return id;
}
