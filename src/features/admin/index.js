import { escapeHtml, joinHtml } from "../../ui/renderHelpers.js";

export function isGeneralAdminSession(session) {
  return session?.authenticated === true && session.level === "general";
}

export function isRegionalAdminSession(session) {
  return session?.authenticated === true && session.level === "region";
}

export function adminScopeLabel(session, regionName = "ta region") {
  return session?.level === "general" ? "toutes les regions" : regionName;
}

export function adminRecentChangeLine(change, formatDate) {
  return `- ${formatDate(change.createdAt)} - ${change.actorLabel} : ${change.summary}`;
}

export function normaliseAdminSession(session) {
  if (!session?.authenticated) return null;
  const level = session.level === "general" ? "general" : session.level === "region" ? "region" : "";
  if (!level) return null;
  return {
    authenticated: true,
    level,
    regionId: String(session.regionId || ""),
    requiresPasswordChange: Boolean(session.requiresPasswordChange),
    recentChanges: normaliseAdminRecentChanges(session.recentChanges),
    regions: normaliseAdminRegions(session.regions),
  };
}

export function normaliseAdminRecentChanges(changes) {
  return Array.isArray(changes)
    ? changes
        .map((change) => ({
          createdAt: String(change?.createdAt || ""),
          summary: String(change?.summary || "Modification des donnees").trim(),
          actorLabel: String(change?.actorLabel || "Utilisateur").trim(),
        }))
        .filter((change) => change.summary)
    : [];
}

export function normaliseAdminRegions(regions) {
  return Array.isArray(regions)
    ? regions
        .map((region) => ({
          id: String(region?.id || "").trim(),
          name: String(region?.name || "Region").trim(),
          hasCustomPassword: Boolean(region?.hasCustomPassword),
          requiresPasswordChange: Boolean(region?.requiresPasswordChange),
        }))
        .filter((region) => region.id)
    : [];
}

export function findAdminRegionInfo(regions, regionId) {
  return normaliseAdminRegions(regions).find((region) => region.id === regionId) || null;
}

export function renderAdminOverviewToolsHtml({ changesCount = 0, showReturnRegion = false, recentEntries = [], displayName }) {
  const regionButton = showReturnRegion
    ? `<button class="text-button" type="button" data-admin-return-region>Revenir a ma region</button>`
    : "";
  return `<section class="admin-role-tools admin-overview-tools">
    <h3>Aide admin</h3>
    <p class="admin-empty">Tu peux modifier les fiches, familles, roles regionaux, annonces d'evenement et imports dans ta zone. Tu ne peux pas modifier les arbres hors de ta zone, contourner le changement de mot de passe, ni voir les mots de passe existants.</p>
    <div class="admin-inline-actions">
      <button class="text-button" type="button" data-admin-show-changes>Journal (${changesCount})</button>
      ${regionButton}
    </div>
    ${renderRecentPeopleToolsHtml(recentEntries, displayName)}
  </section>`;
}

export function renderRecentPeopleToolsHtml(entries, displayName) {
  if (!entries.length) return `<p class="field-hint">Les dernieres fiches consultees apparaitront ici.</p>`;
  const chips = joinHtml(
    entries,
    ({ person, genealogy }) => `<button class="chip stat-person-chip" type="button" data-stat-person-id="${escapeHtml(person.id)}" data-stat-genealogy-id="${escapeHtml(genealogy.id)}"><span class="stat-person-name">${escapeHtml(displayName(person))}</span><span class="chip-note">${escapeHtml(genealogy.name)}</span></button>`
  );
  return `<div class="admin-recent-list"><strong>Dernieres fiches consultees</strong><div class="chip-list">${chips}</div></div>`;
}

export function renderAdminPasswordToolsHtml({ isGeneralAdmin = false, activeRegion = null, adminRegion = null, adminRegions = [], regionalGenealogies = [] }) {
  if (isGeneralAdmin) {
    const passwordList = renderRegionalPasswordListHtml(adminRegions, regionalGenealogies);
    if (activeRegion) {
      const regionInfo = findAdminRegionInfo(adminRegions, activeRegion.id);
      const passwordText = regionInfo?.hasCustomPassword ? "Acces regional actif." : "Acces regional non configure.";
      return `<section class="admin-role-tools">
        <h3>Mot de passe admin - ${escapeHtml(activeRegion.name)}</h3>
        <p class="admin-empty">${passwordText}</p>
        <button class="text-button" type="button" data-admin-change-password="${escapeHtml(activeRegion.id)}">Modifier le mot de passe regional</button>
      </section>${passwordList}`;
    }
    return `<section class="admin-role-tools">
      <h3>Mot de passe admin general</h3>
      <p class="admin-empty">Le mot de passe general est verifie cote serveur et n'est plus expose dans le site.</p>
    </section>${passwordList}`;
  }

  if (!adminRegion) return "";
  const regionInfo = findAdminRegionInfo(adminRegions, adminRegion.id);
  const passwordState = regionInfo?.hasCustomPassword
    ? "Mot de passe personnalise actif."
    : "Mot de passe regional non configure.";
  return `<section class="admin-role-tools">
    <h3>Mon mot de passe admin</h3>
    <p class="admin-empty">${escapeHtml(adminRegion.name)} - ${passwordState}</p>
    <button class="text-button" type="button" data-admin-change-password="${escapeHtml(adminRegion.id)}">Changer mon mot de passe</button>
  </section>`;
}

export function renderAdminPasswordRequiredNotice() {
  return `<section class="admin-security-warning">
    <h3>Changement de mot de passe requis</h3>
    <p>Ce compte regional doit definir un mot de passe personnalise avant de modifier les donnees.</p>
  </section>`;
}

export function renderRegionalPasswordListHtml(adminRegions, regionalGenealogies = []) {
  const regions = adminRegions.length
    ? [...normaliseAdminRegions(adminRegions)].sort((a, b) => a.name.localeCompare(b.name, "fr"))
    : [...regionalGenealogies]
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"))
        .map((region) => ({ id: region.id, name: region.name, hasCustomPassword: false }));
  if (!regions.length) {
    return `<section class="admin-role-tools">
      <h3>Mots de passe regionaux</h3>
      <p class="admin-empty">Aucune region creee pour le moment.</p>
    </section>`;
  }

  const rows = joinHtml(regions, (region) => {
    const detail = region.hasCustomPassword
      ? "Mot de passe personnalise actif, masque pour securite"
      : "Acces admin regional non configure";
    return `<div class="admin-password-row">
      <span>
        <strong>${escapeHtml(region.name)}</strong>
        <small>${detail}</small>
      </span>
      <button class="text-button" type="button" data-admin-change-password="${escapeHtml(region.id)}">Modifier</button>
    </div>`;
  });

  return `<section class="admin-role-tools">
    <h3>Mots de passe regionaux</h3>
    <div class="admin-password-list">${rows}</div>
    <p class="field-hint">Les mots de passe regionaux sont stockes haches cote serveur. En cas de perte, l'admin general peut les remplacer ou desactiver l'acces regional.</p>
  </section>`;
}

export function renderAdminRoleToolsHtml({ region = null, customRoles = [], cooptageRoleId = "", cooptageRoleOptions = [], defaultCooptageRoleId = "tva" }) {
  if (!region) {
    return `<section class="admin-role-tools">
      <h3>Roles regionaux</h3>
      <p class="admin-empty">Ouvre une faluche de region/ville ou une famille pour gerer ses roles propres.</p>
    </section>`;
  }

  const cooptageRoleOptionsHtml = joinHtml(
    cooptageRoleOptions,
    (role) => `<option value="${escapeHtml(role.id)}" ${role.id === cooptageRoleId ? "selected" : ""}>${escapeHtml(role.id === defaultCooptageRoleId ? "TVA" : role.label)}</option>`
  );
  const roleRows = customRoles.length
    ? joinHtml(
        customRoles,
        (role) => `<div class="admin-role-row">
          <span>${escapeHtml(role.label)}</span>
          <button class="text-button" type="button" data-admin-rename-role="${escapeHtml(role.id)}">Modifier</button>
          <button class="text-button danger-text" type="button" data-admin-delete-role="${escapeHtml(role.id)}">Supprimer</button>
        </div>`
      )
    : `<p class="admin-empty">Aucun role propre a cette region.</p>`;

  return `<section class="admin-role-tools">
    <h3>Roles de ${escapeHtml(region.name)}</h3>
    <label class="admin-role-setting">Role du cooptage
      <select data-admin-cooptage-role>${cooptageRoleOptionsHtml}</select>
    </label>
    <div class="admin-role-add">
      <input data-admin-role-name placeholder="Nouveau role regional" />
      <button class="text-button" type="button" data-admin-add-role>Ajouter</button>
    </div>
    <div class="admin-role-list">${roleRows}</div>
    <p class="field-hint">Ces roles sont disponibles pour cette region et ses familles. Le national les comptabilise automatiquement.</p>
  </section>`;
}

export function renderAdminPeopleToolsHtml({ overviewTools = "", passwordTools = "", roleTools = "", people = [], selectedIds = [], targetGenealogies = [], displayName, filiereLabel }) {
  if (!people.length) {
    return `${overviewTools}${passwordTools}${roleTools}<p class="admin-empty">Aucune fiche dans l'arbre ouvert.</p>`;
  }

  const selectedCount = selectedIds.length;
  const allSelected = people.length > 0 && selectedCount === people.length;
  const targetOptions = renderTargetGenealogyOptions(targetGenealogies);
  const canTransfer = targetGenealogies.length && selectedCount;
  const bulkActions = `
    <div class="admin-bulk-actions">
      <label class="admin-select-all">
        <input type="checkbox" data-admin-select-all ${allSelected ? "checked" : ""} />
        <span>${selectedCount ? `${selectedCount} selectionnee(s)` : "Selectionner tout"}</span>
      </label>
      <select data-admin-bulk-transfer-target ${canTransfer ? "" : "disabled"}>
        <option value="">Destination...</option>
        ${targetOptions}
      </select>
      <button class="text-button" type="button" data-admin-transfer-selected ${canTransfer ? "" : "disabled"}>Transferer</button>
      <button class="text-button danger-text" type="button" data-admin-delete-selected ${selectedCount ? "" : "disabled"}>Effacer</button>
    </div>`;

  const peopleRows = joinHtml(
    people,
    (person) => `<div class="admin-person-row" data-admin-person-row>
      <label class="admin-person-choice">
        <input type="checkbox" value="${escapeHtml(person.id)}" data-admin-select-person ${selectedIds.includes(person.id) ? "checked" : ""} />
        <span>
          <strong>${escapeHtml(displayName(person))}</strong>
          <small>${escapeHtml(filiereLabel(person.filiere))}</small>
        </span>
      </label>
      <select data-admin-transfer-target data-admin-transfer-person="${escapeHtml(person.id)}" ${targetGenealogies.length ? "" : "disabled"}>
        <option value="">Transferer vers...</option>
        ${targetOptions}
      </select>
      <button class="text-button danger-text" type="button" data-admin-delete-person="${escapeHtml(person.id)}">Effacer</button>
    </div>`
  );
  return `${overviewTools}${passwordTools}${roleTools}${bulkActions}<div class="admin-person-list">${peopleRows}</div>`;
}

function renderTargetGenealogyOptions(genealogies) {
  return joinHtml(genealogies, (genealogy) => `<option value="${escapeHtml(genealogy.id)}">${escapeHtml(genealogy.name)}</option>`);
}

export function renderAdminToolsView({
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
}) {
  els.adminButton.textContent = state.adminMode ? `Quitter admin${isRegionalAdmin() ? " regional" : ""}` : "Admin";
  els.adminButton.classList.toggle("is-active", state.adminMode);
  els.adminPanel.hidden = !state.adminMode;
  const passwordChangeRequired = adminPasswordChangeRequired();
  els.adminImportAllButton.hidden = !isGeneralAdmin();
  els.adminExportAllButton.hidden = !isGeneralAdmin();
  els.adminImportAllButton.disabled = passwordChangeRequired;
  els.adminExportAllButton.disabled = passwordChangeRequired;
  els.adminImportActiveButton.disabled = passwordChangeRequired || (state.adminMode && !genealogyInAdminScope(activeGenealogy()));
  els.adminExportActiveButton.disabled = passwordChangeRequired || (state.adminMode && !genealogyInAdminScope(activeGenealogy()));
  if (!state.adminMode) {
    els.adminPeopleTools.innerHTML = "";
    return;
  }

  const current = activeGenealogy();
  const overviewTools = renderAdminOverviewToolsHtml({
    changesCount: state.adminRecentChanges.length,
    showReturnRegion: isRegionalAdmin() && state.adminRegionId && state.activeGenealogyId !== state.adminRegionId,
    recentEntries: recentPersonEntries(),
    displayName,
  });
  const activeRegion = roleRegionForGenealogy(activeGenealogy());
  const passwordTools = renderAdminPasswordToolsHtml({
    isGeneralAdmin: isGeneralAdmin(),
    activeRegion,
    adminRegion: adminRegion(),
    adminRegions: state.adminRegions,
    regionalGenealogies: state.genealogies.filter(isRegionalGenealogy),
  });
  if (passwordChangeRequired) {
    els.adminPeopleTools.innerHTML = `${overviewTools}${renderAdminPasswordRequiredNotice()}${passwordTools}`;
    return;
  }

  const targetGenealogies = state.genealogies.filter((genealogy) => genealogy.id !== current.id && genealogyInAdminScope(genealogy));
  const sortedPeople = state.people.slice().sort(comparePeopleByFiliereAndName);
  const selectedIds = sanitisedAdminSelection();
  const roleRegion = roleRegionForGenealogy(activeGenealogy());
  const cooptageRole = roleRegion ? cooptageRoleOptionForRegion(roleRegion) : null;
  const roleTools = renderAdminRoleToolsHtml({
    region: roleRegion,
    customRoles: roleRegion ? normaliseRoleOptions(roleRegion.customRoles) : [],
    cooptageRoleId: cooptageRole?.id || "",
    cooptageRoleOptions: roleRegion ? roleOptionsForGenealogy(roleRegion, [defaultCooptageRoleId]) : [],
    defaultCooptageRoleId,
  });

  els.adminPeopleTools.innerHTML = renderAdminPeopleToolsHtml({
    overviewTools,
    passwordTools,
    roleTools,
    people: sortedPeople,
    selectedIds,
    targetGenealogies,
    displayName,
    filiereLabel,
  });
}
