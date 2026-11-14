/*
  Unit tests of js/compte/regles.js (Phase 6): the merge of the progress (phone + online),
  the week of the classement, what may be sent to the classement, the codes refused.
  Nothing to install: Node 18 or later.

      node tests/test_sync.mjs
*/
import assert from "node:assert/strict";
import {
  pseudoOk, codeOk, codeTropFacile, codePromoOk, fusionnerProgres, memesDonnees,
  jourParis, semaineISO, joursDeLaSemaine, xpSemaine, scoreAEnvoyer,
} from "../js/compte/regles.js";

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failures.push(name);
    console.log(`FAIL  ${name}\n      ${error.message.split("\n").join("\n      ")}`);
  }
}

const reviser = (fields) => ({ v: 1, xp: 0, days: {}, done: {}, cards: {}, runs: {}, lastTheme: null, ...fields });

// ---- What may be typed ------------------------------------------------------------------
test("pseudo: 3 to 15 of a-z A-Z 0-9 - _", () => {
  for (const ok of ["Sam", "sam_42", "Jean-Luc", "abcdefghijklmno"]) assert.ok(pseudoOk(ok), ok);
  for (const bad of ["", "ab", "abcdefghijklmnop", "Léa", "sam 42", "sam@x", "sam.x"]) assert.ok(!pseudoOk(bad), bad);
});
test("code: exactly 6 digits", () => {
  assert.ok(codeOk("481930"));
  for (const bad of ["48193", "4819301", "48193a", "", " 48193"]) assert.ok(!codeOk(bad), bad);
});
test("class code: 4 to 20 letters, digits or -", () => {
  assert.ok(codePromoOk("mapst-nice-27"));
  for (const bad of ["abc", "a/b/c/d", "code promo", "x".repeat(21)]) assert.ok(!codePromoOk(bad), bad);
});
test("obvious codes are refused", () => {
  for (const easy of ["000000", "777777", "123456", "654321", "012345", "987654", "890123", "210987",
    "121212", "909090", "123123", "456456", "123321", "908809", "112233", "111222"]) assert.ok(codeTropFacile(easy), easy);
});
test("ordinary codes are accepted", () => {
  for (const fine of ["481930", "270514", "839201", "102938", "556677", "135792"]) assert.ok(!codeTropFacile(fine), fine);
});

// ---- The merge ---------------------------------------------------------------------------
test("xp: the larger", () => {
  const m = fusionnerProgres({ reviser: reviser({ xp: 120 }) }, { reviser: reviser({ xp: 300 }) });
  assert.equal(m.reviser.xp, 300);
  const n = fusionnerProgres({ reviser: reviser({ xp: 500 }) }, { reviser: reviser({ xp: 300 }) });
  assert.equal(n.reviser.xp, 500);
});
test("days: for each day, the entry with the larger xp", () => {
  const a = reviser({ days: { "2026-11-10": { xp: 40, done: 2 }, "2026-11-11": { xp: 10, done: 1 } } });
  const b = reviser({ days: { "2026-11-11": { xp: 60, done: 3 }, "2026-11-12": { xp: 20, done: 1 } } });
  const m = fusionnerProgres({ reviser: a }, { reviser: b });
  assert.deepEqual(m.reviser.days, {
    "2026-11-10": { xp: 40, done: 2 }, "2026-11-11": { xp: 60, done: 3 }, "2026-11-12": { xp: 20, done: 1 },
  });
});
test("done: for each question, the larger value", () => {
  const m = fusionnerProgres({ reviser: reviser({ done: { q1: 1, q2: 2, q3: 1 } }) }, { reviser: reviser({ done: { q1: 2, q2: 1, q4: 1 } }) });
  assert.deepEqual(m.reviser.done, { q1: 2, q2: 2, q3: 1, q4: 1 });
});
test("cards, runs, lastTheme: from the side saved last (the phone)", () => {
  const a = reviser({ cards: { q1: { box: 0, due: "2026-11-13", wrong: 1 } }, runs: { "t:1": { right: ["q1"] } }, lastTheme: "anatomie" });
  const b = reviser({ cards: { q9: { box: 2, due: "2026-11-20", wrong: 1 } }, runs: {}, lastTheme: "securite" });
  const m = fusionnerProgres({ reviser: a }, { reviser: b }, { localT: 2000, distantT: 1000 });
  assert.deepEqual(m.reviser.cards, a.cards);
  assert.deepEqual(m.reviser.runs, a.runs);
  assert.equal(m.reviser.lastTheme, "anatomie");
});
test("cards, runs, lastTheme: from the side saved last (online)", () => {
  const a = reviser({ cards: { q1: { box: 0 } }, lastTheme: "anatomie" });
  const b = reviser({ cards: { q9: { box: 2 } }, runs: { "t:2": { right: [] } }, lastTheme: "securite" });
  const m = fusionnerProgres({ reviser: a }, { reviser: b }, { localT: 1000, distantT: 2000 });
  assert.deepEqual(m.reviser.cards, b.cards);
  assert.deepEqual(m.reviser.runs, b.runs);
  assert.equal(m.reviser.lastTheme, "securite");
});
test("lessons: « lue » wins, else the further card", () => {
  const local = { "a": { at: 3 }, "b": { at: 0, read: "2026-11-10" }, "c": { at: 2 }, "d": { at: 5 } };
  const online = { "a": { at: 0, read: "2026-11-12" }, "b": { at: 4 }, "c": { at: 6 }, "e": { at: 1 } };
  const m = fusionnerProgres({ lecons: local }, { lecons: online });
  assert.deepEqual(m.lecons.a, { at: 0, read: "2026-11-12" });
  assert.deepEqual(m.lecons.b, { at: 0, read: "2026-11-10" });
  assert.equal(m.lecons.c.at, 6);
  assert.ok(!m.lecons.c.read);
  assert.deepEqual(m.lecons.d, { at: 5 });
  assert.deepEqual(m.lecons.e, { at: 1 });
});
test("lessons read on both sides: the later day", () => {
  const m = fusionnerProgres({ lecons: { a: { at: 0, read: "2026-11-01" } } }, { lecons: { a: { at: 2, read: "2026-11-09" } } });
  assert.equal(m.lecons.a.read, "2026-11-09");
  assert.equal(m.lecons.a.at, 2);
});
test("nothing online yet: the phone's progress, unchanged", () => {
  const local = { reviser: reviser({ xp: 80, done: { q1: 2 }, days: { "2026-11-13": { xp: 80, done: 1 } } }), lecons: { a: { at: 2 } } };
  const m = fusionnerProgres(local, null, { localT: 5 });
  assert.ok(memesDonnees(m, local));
});
test("nothing on the phone: the online progress", () => {
  const online = { v: 1, reviser: reviser({ xp: 80, lastTheme: "x", cards: { q: { box: 1 } } }), lecons: { a: { at: 0, read: "2026-11-02" } } };
  const m = fusionnerProgres({ reviser: null, lecons: {} }, online, { localT: 0, distantT: 9 });
  assert.ok(memesDonnees(m, { reviser: online.reviser, lecons: online.lecons }));
});
test("merging twice changes nothing more (both sides end the same)", () => {
  const a = { reviser: reviser({ xp: 40, done: { q1: 1 }, days: { d1: { xp: 40, done: 1 } } }), lecons: { x: { at: 2 } } };
  const b = { reviser: reviser({ xp: 90, done: { q2: 2 }, days: { d2: { xp: 50, done: 1 } } }), lecons: { y: { at: 0, read: "2026-11-01" } } };
  const once = fusionnerProgres(a, b, { localT: 1, distantT: 2 });
  assert.ok(memesDonnees(fusionnerProgres(once, once, { localT: 3, distantT: 3 }), once));
  assert.ok(memesDonnees(fusionnerProgres(once, b, { localT: 3, distantT: 2 }), once));
});
test("broken data is ignored, never thrown", () => {
  const m = fusionnerProgres({ reviser: "nope", lecons: [1, 2] }, { reviser: { v: 2, xp: 99 }, lecons: null });
  assert.equal(m.reviser.xp, 0);
  assert.deepEqual(m.lecons, {});
});
test("memesDonnees ignores the order of the keys", () => {
  assert.ok(memesDonnees({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }));
  assert.ok(!memesDonnees({ a: 1 }, { a: 2 }));
});

// ---- The week (Europe/Paris, Monday first) -------------------------------------------------
test("ISO week: 13 Nov 2026 is 2026-W46", () => {
  assert.equal(semaineISO(new Date("2026-11-13T12:00:00+01:00")), "2026-W46");
});
test("ISO week: Monday starts it, in Paris time", () => {
  assert.equal(semaineISO(new Date("2026-11-15T23:30:00+01:00")), "2026-W46");   // Sunday night
  assert.equal(semaineISO(new Date("2026-11-16T00:30:00+01:00")), "2026-W47");   // Monday, 00:30 in Paris
  assert.equal(semaineISO(new Date("2026-11-15T23:30:00Z")), "2026-W47");        // = Monday 00:30 in Paris
});
test("ISO week: around the new year", () => {
  assert.equal(semaineISO(new Date("2027-01-01T12:00:00+01:00")), "2026-W53");
  assert.equal(semaineISO(new Date("2027-01-04T12:00:00+01:00")), "2027-W01");
  assert.equal(semaineISO(new Date("2026-01-01T12:00:00+01:00")), "2026-W01");
});
test("the day in Paris, whatever the clock's zone", () => {
  assert.equal(jourParis(new Date("2026-11-13T23:30:00Z")), "2026-11-14");
});
test("the seven days of the week", () => {
  assert.deepEqual(joursDeLaSemaine(new Date("2026-11-13T12:00:00+01:00")),
    ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
});
test("XP of the week: the days of this week only", () => {
  const days = { "2026-11-08": { xp: 500 }, "2026-11-09": { xp: 30 }, "2026-11-13": { xp: 45 }, "2026-11-16": { xp: 70 }, "x": "broken" };
  assert.equal(xpSemaine(days, new Date("2026-11-13T12:00:00+01:00")), 75);
  assert.equal(xpSemaine(null), 0);
});

// ---- What may be sent to the classement ------------------------------------------------------
const W = "2026-W46";
test("first line ever: up to 3 000", () => {
  assert.equal(scoreAEnvoyer({ reel: 250, semaine: W, ligne: null }), 250);
  assert.equal(scoreAEnvoyer({ reel: 5000, semaine: W, ligne: null }), 3000);
  assert.equal(scoreAEnvoyer({ reel: 0, semaine: W, ligne: null }), null);
});
test("same week: never less, never more than +400", () => {
  assert.equal(scoreAEnvoyer({ reel: 120, semaine: W, ligne: { semaine: W, xp: 120 } }), null);
  assert.equal(scoreAEnvoyer({ reel: 100, semaine: W, ligne: { semaine: W, xp: 120 } }), null);
  assert.equal(scoreAEnvoyer({ reel: 300, semaine: W, ligne: { semaine: W, xp: 120 } }), 300);
  assert.equal(scoreAEnvoyer({ reel: 900, semaine: W, ligne: { semaine: W, xp: 120 } }), 520);
});
test("new week: 400 at most on the first write", () => {
  assert.equal(scoreAEnvoyer({ reel: 90, semaine: "2026-W47", ligne: { semaine: W, xp: 2000 } }), 90);
  assert.equal(scoreAEnvoyer({ reel: 700, semaine: "2026-W47", ligne: { semaine: W, xp: 10 } }), 400);
  assert.equal(scoreAEnvoyer({ reel: 0, semaine: "2026-W47", ligne: { semaine: W, xp: 10 } }), null);
  assert.equal(scoreAEnvoyer({ reel: 50, semaine: "2027-W01", ligne: { semaine: "2026-W53", xp: 10 } }), 50);
});
test("a line from a later week (phone clock late): nothing", () => {
  assert.equal(scoreAEnvoyer({ reel: 50, semaine: W, ligne: { semaine: "2026-W47", xp: 10 } }), null);
});
test("the steps reach the real number, each one allowed by the rules", () => {
  let line = null;
  const sent = [];
  for (let i = 0; i < 20; i++) {
    const xp = scoreAEnvoyer({ reel: 4600, semaine: W, ligne: line });
    if (xp === null) break;
    if (line) assert.ok(xp >= line.xp && xp - line.xp <= 400);
    else assert.ok(xp <= 3000);
    sent.push(xp);
    line = { semaine: W, xp };
  }
  assert.deepEqual(sent, [3000, 3400, 3800, 4200, 4600]);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
