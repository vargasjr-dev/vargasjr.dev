import { test } from "node:test";
import assert from "node:assert/strict";

import { compareCasesForWork } from "./velcro";

function caseOf(
  id: number,
  overrides: { priority?: number; status?: string; createdAt?: string },
) {
  return {
    id,
    priority: overrides.priority ?? 50,
    status: overrides.status ?? "open",
    createdAt: overrides.createdAt ?? "2026-10-22T00:00:00Z",
  };
}

test("compareCasesForWork puts open cases ahead of closed ones", () => {
  const closed = caseOf(1, { priority: 100, status: "closed" });
  const open = caseOf(2, { priority: 1 });
  assert.equal(compareCasesForWork(open, closed), -1);
  assert.equal(compareCasesForWork(closed, open), 1);
});

test("compareCasesForWork sorts by manual priority, high first", () => {
  const high = caseOf(1, { priority: 80 });
  const low = caseOf(2, { priority: 20 });
  assert.equal(compareCasesForWork(high, low), -1);
  assert.equal(compareCasesForWork(low, high), 1);
  assert.equal(compareCasesForWork(high, caseOf(3, { priority: 80 })), 0);
});

test("compareCasesForWork breaks priority ties newest first", () => {
  const older = caseOf(1, { createdAt: "2026-10-01T00:00:00Z" });
  const newer = caseOf(2, { createdAt: "2026-10-02T00:00:00Z" });
  assert.equal(compareCasesForWork(newer, older), -1);
  assert.equal(compareCasesForWork(older, newer), 1);
});

test("compareCasesForWork full worklist ordering", () => {
  const list = [
    caseOf(1, { priority: 10 }),
    caseOf(2, { priority: 90, status: "closed" }),
    caseOf(3, { priority: 50, createdAt: "2026-10-01T00:00:00Z" }),
    caseOf(4, { priority: 90 }),
    caseOf(5, { priority: 50, createdAt: "2026-10-03T00:00:00Z" }),
  ];
  const sorted = [...list].sort(compareCasesForWork);
  assert.deepEqual(
    sorted.map((c) => c.id),
    [4, 5, 3, 1, 2],
  );
});
