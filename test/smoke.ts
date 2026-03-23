/**
 * Smoke test — validates storage, tools, and inject hook work correctly
 * without loading OpenClaw runtime. Run with: node --import tsx test/smoke.ts
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  readTasks,
  writeTasks,
  readNotes,
  writeNotes,
  appendNotes,
} from "../src/storage.js";
import { createTasksTool } from "../src/tools/tasks.js";
import { createNoteTool } from "../src/tools/note.js";
import { createInjectHook } from "../src/hooks/inject.js";

let tmpDir: string;
const SESSION = "test-session-001";
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

async function testStorage() {
  console.log("\n── Storage ──");

  // Tasks: empty on first read
  const empty = await readTasks(tmpDir, SESSION);
  assert(empty.tasks.length === 0, "readTasks returns empty on missing file");

  // Tasks: write + read roundtrip
  const state = {
    tasks: [
      { id: "t1", content: "Do thing", status: "pending" as const, priority: "high" as const },
    ],
    updatedAt: new Date().toISOString(),
  };
  await writeTasks(tmpDir, SESSION, state);
  const read = await readTasks(tmpDir, SESSION);
  assert(read.tasks.length === 1, "writeTasks → readTasks roundtrip");
  assert(read.tasks[0].content === "Do thing", "task content preserved");

  // Notes: empty on first read
  const emptyNotes = await readNotes(tmpDir, SESSION);
  assert(emptyNotes === "", "readNotes returns empty string on missing file");

  // Notes: write + read
  await writeNotes(tmpDir, SESSION, "hello world");
  assert((await readNotes(tmpDir, SESSION)) === "hello world", "writeNotes → readNotes roundtrip");

  // Notes: append
  await appendNotes(tmpDir, SESSION, "line 2");
  const appended = await readNotes(tmpDir, SESSION);
  assert(appended.includes("hello world") && appended.includes("line 2"), "appendNotes works");
}

async function testTools() {
  console.log("\n── Tools ──");

  const taskTool = createTasksTool(tmpDir, SESSION + "-tools", { warnCompletedTasks: 30 });
  assert(taskTool.name === "pawpad_tasks", "taskTool.name correct");
  assert(typeof taskTool.execute === "function", "taskTool.execute is function");
  assert(taskTool.parameters !== undefined, "taskTool.parameters defined");

  // Read empty
  const readResult = await taskTool.execute("tc1", { action: "read" } as any);
  assert(
    readResult.content[0].type === "text" &&
      (readResult.content[0] as any).text.includes("No tasks"),
    "tasks read returns empty message"
  );

  // Write
  const writeResult = await taskTool.execute("tc2", {
    action: "write",
    tasks: [
      { id: "t1", content: "Test", status: "pending", priority: "medium" },
    ],
  } as any);
  assert(
    (writeResult.content[0] as any).text.includes("1 task"),
    "tasks write returns count"
  );

  // Note tool
  const noteTool = createNoteTool(tmpDir, SESSION + "-tools", { warnNoteChars: 10000 });
  assert(noteTool.name === "pawpad_note", "noteTool.name correct");

  const appendResult = await noteTool.execute("tc3", {
    action: "append",
    content: "Remember this",
  } as any);
  assert((appendResult.content[0] as any).text.includes("appended"), "note append works");

  const noteRead = await noteTool.execute("tc4", { action: "read" } as any);
  assert((noteRead.content[0] as any).text.includes("Remember this"), "note read after append");
}

async function testInjectHook() {
  console.log("\n── Inject Hook ──");

  const hook = createInjectHook(tmpDir);

  // Empty session → no injection
  const emptyResult = await hook(
    { prompt: "hi", messages: [] },
    { sessionId: "empty-session" }
  );
  assert(emptyResult === undefined, "no injection for empty session");

  // Session with data → injects
  const sid = SESSION + "-inject";
  await writeTasks(tmpDir, sid, {
    tasks: [
      { id: "t1", content: "Build API", status: "completed", priority: "high" },
      { id: "t2", content: "Write tests", status: "pending", priority: "medium" },
    ],
    updatedAt: new Date().toISOString(),
  });
  await writeNotes(tmpDir, sid, "User prefers REST.");

  const result = await hook(
    { prompt: "next step?", messages: [] },
    { sessionId: sid }
  );
  assert(result !== undefined, "injection returned for session with data");
  assert(
    typeof result?.appendSystemContext === "string",
    "appendSystemContext is string"
  );
  const ctx = result!.appendSystemContext!;
  assert(ctx.includes("PawPad"), "contains PawPad header");
  assert(ctx.includes("Build API"), "contains task content");
  assert(ctx.includes("[x]"), "completed task has [x]");
  assert(ctx.includes("REST"), "contains note content");
  assert(ctx.includes("1/2 done"), "shows progress count");

  // No sessionId → no injection
  const noSid = await hook(
    { prompt: "hi", messages: [] },
    {} as any
  );
  assert(noSid === undefined, "no injection without sessionId");
}

// ── Run ──

(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "pawpad-test-"));
  console.log(`Test dir: ${tmpDir}`);

  try {
    await testStorage();
    await testTools();
    await testInjectHook();
  } catch (err) {
    console.error("\n💥 Unexpected error:", err);
    failed++;
  }

  await rm(tmpDir, { recursive: true, force: true });

  console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
  process.exit(failed > 0 ? 1 : 0);
})();
