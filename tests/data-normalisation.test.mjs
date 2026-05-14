import assert from "node:assert/strict";

import {
  makeId,
  normaliseBaptismStatus,
  normaliseCrossGroupSize,
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
} from "../modules/data.js";
import { labelFromMap, labels } from "../modules/labels.js";

assert.equal(stripAccents("Besançon Nîmes"), "Besancon Nimes");
assert.equal(normalisedText("  Événement À Venir  "), "evenement a venir");
assert.equal(makeId("La faluche nîmoise"), "la-faluche-nimoise");

assert.deepEqual(uniqueIds(["a", "a", 12, "", null]), ["a", "12"]);
assert.deepEqual(toIdArray(["a", "a", 12]), ["a", "12"]);
assert.deepEqual(toIdArray("a"), []);

assert.equal(normaliseRoleId("Président Pow-Wow"), "president-pow-wow");
assert.deepEqual(normaliseRoles(["TVA", "tva", "Président Pow-Wow"]), ["tva", "president-pow-wow"]);
assert.deepEqual(normaliseNicknames([" TriSoeur ", "TriSoeur", "Bulbi"], "fallback"), ["TriSoeur", "Bulbi"]);
assert.deepEqual(normaliseNicknames("", "fallback"), ["fallback"]);

assert.equal(normaliseBaptismStatus("unbaptized"), "unbaptized");
assert.equal(normaliseBaptismStatus("baptized"), "unknown");
assert.equal(normaliseCrossGroupSize(2, 10), 2);
assert.equal(normaliseCrossGroupSize(11, 10), 0);
assert.equal(normaliseDateTimeLocal("2026-05-13 18:30:12"), "2026-05-13T18:30");
assert.equal(normaliseDateTimeLocal("2026-05-13"), "2026-05-13T00:00");
assert.equal(normaliseDateTimeLocal("13/05/2026"), "");
assert.equal(normaliseUpcomingEventType("Cooptage"), "cooptage");
assert.equal(normaliseUpcomingEventType("inconnu"), "bapteme");
assert.equal(readDepth("5.8", 20, 20), 5);
assert.equal(readDepth("999", 20, 20), 20);
assert.equal(readDepth("x", 12, 20), 12);

assert.equal(labelFromMap(labels.serverStatus, "saved", "fallback"), "Sauvegardé");
assert.equal(labelFromMap(labels.serverStatus, "missing", "fallback"), "fallback");

console.log("data-normalisation: ok");
