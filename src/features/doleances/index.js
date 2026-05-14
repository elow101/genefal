import { labelFromMap, labels } from "../../../modules/labels.js";
import { escapeHtml } from "../../ui/renderHelpers.js";

export function pendingDoleanceCount(doleances) {
  return normaliseDoleances(doleances).filter((item) => item.status !== "resolved").length;
}

export function publicDoleancePanelHtml() {
  return `<div class="doleance-dialog" role="dialog" aria-modal="true" aria-labelledby="doleanceTitle">
    <div class="doleance-head">
      <div>
        <h2 id="doleanceTitle">Dol&eacute;ances anonymes</h2>
        <p>Signaler un bug, une demande de retrait ou une modification. Aucun nom n'est demande.</p>
      </div>
      <button class="text-button" type="button" data-doleance-close>Fermer</button>
    </div>
    <form class="doleance-form" data-doleance-form>
      <label>
        Type de demande
        <select name="type">
          <option value="bug">Bug</option>
          <option value="retrait">Demande de retrait</option>
          <option value="modification">Demande de modification</option>
          <option value="autre">Autre</option>
        </select>
      </label>
      <label>
        Fiche ou arbre concerne (facultatif)
        <input name="target" maxlength="160" autocomplete="off" placeholder="Nom, surnom, famille..." />
      </label>
      <label>
        Message
        <textarea name="message" maxlength="2000" required placeholder="Decris la demande assez precisement pour que l'admin puisse agir."></textarea>
      </label>
      <div class="form-actions">
        <button class="primary" type="submit">Envoyer anonymement</button>
        <button class="text-button" type="button" data-doleance-close>Annuler</button>
      </div>
    </form>
  </div>`;
}

export function adminDoleancePanelHtml(doleances) {
  const rows = normaliseDoleances(doleances)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(doleanceCardHtml)
    .join("");
  return `<div class="doleance-dialog" role="dialog" aria-modal="true" aria-labelledby="doleanceAdminTitle">
    <div class="doleance-head">
      <div>
        <h2 id="doleanceAdminTitle">Dol&eacute;ances re&ccedil;ues</h2>
        <p>Les messages marques comme lus/resolus seront effaces en quittant le mode admin.</p>
      </div>
      <button class="text-button" type="button" data-doleance-close>Fermer</button>
    </div>
    <div class="doleance-list">
      ${rows || `<p class="admin-empty">Aucune doleance pour le moment.</p>`}
    </div>
  </div>`;
}

export function doleanceCardHtml(item) {
  const normalised = normaliseDoleances([item])[0];
  if (!normalised) return "";
  const isResolved = normalised.status === "resolved";
  return `<article class="doleance-card${isResolved ? " is-resolved" : ""}">
    <div class="doleance-meta">
      <strong>${escapeHtml(doleanceTypeLabel(normalised.type))}</strong>
      <span>${escapeHtml(formatDoleanceDate(normalised.createdAt))}</span>
    </div>
    ${normalised.target ? `<small>Concerne : ${escapeHtml(normalised.target)}</small>` : ""}
    <p class="doleance-message">${escapeHtml(normalised.message)}</p>
    <div class="doleance-status">
      <span class="doleance-badge">${isResolved ? "Lu / resolu" : "En attente"}</span>
      <label>
        <input type="checkbox" data-doleance-read="${escapeHtml(normalised.id)}" ${isResolved ? "checked" : ""} />
        Lu / resolu
      </label>
      <button class="text-button" type="button" data-doleance-pending="${escapeHtml(normalised.id)}" ${isResolved ? "" : "disabled"}>Remettre en attente</button>
    </div>
  </article>`;
}

export function makeDoleance(payload, now = new Date()) {
  return {
    id: `doleance-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    type: normaliseDoleanceType(payload?.type),
    target: String(payload?.target || "").trim().slice(0, 160),
    message: String(payload?.message || "").trim().slice(0, 2000),
    status: "pending",
    createdAt: now.toISOString(),
  };
}

export function normaliseDoleances(input, now = new Date()) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input
    .map((item) => {
      const message = String(item?.message || "").trim().slice(0, 2000);
      if (!message) return null;
      const createdAt = String(item?.createdAt || "").trim();
      const id = String(item?.id || makeDoleance({ message }, now).id);
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        type: normaliseDoleanceType(item?.type),
        target: String(item?.target || "").trim().slice(0, 160),
        message,
        status: item?.status === "resolved" ? "resolved" : "pending",
        createdAt: Number.isNaN(new Date(createdAt).getTime()) ? now.toISOString() : createdAt,
      };
    })
    .filter(Boolean);
}

export function normaliseDoleanceType(value) {
  return ["bug", "retrait", "modification", "autre"].includes(value) ? value : "autre";
}

export function doleanceTypeLabel(value) {
  return labelFromMap(labels.doleanceType, normaliseDoleanceType(value), labels.doleanceType.autre);
}

export function formatDoleanceDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
