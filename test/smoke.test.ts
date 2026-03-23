/**
 * Smoke test — validates storage, tools, and inject hook work correctly
 * without loading OpenClaw runtime.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

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

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "pawpad-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Storage", () => {
  it("readTasks returns empty on missing file", async () => {
    const empty = await readTasks(tmpDir, SESSION);
    expect(empty.tasks).toHaveLength(0);
  });

  it("writeTasks → readTasks roundtrip", async () => {
    const state = {
      tasks: [
        { id: "t1", content: "Do thing", status: "pending" as const, priority: "high" as const },
      ],
      updatedAt: new Date().toISOString(),
    };
    await writeTasks(tmpDir, SESSION, state);
    const read = await readTasks(tmpDir, SESSION);
    expect(read.tasks).toHaveLength(1);
    expect(read.tasks[0].content).toBe("Do thing");
  });

  it("readNotes returns empty string on missing file", async () => {
    const emptyNotes = await readNotes(tmpDir, SESSION);
    expect(emptyNotes).toBe("");
  });

  it("writeNotes → readNotes roundtrip", async () => {
    await writeNotes(tmpDir, SESSION, "hello world");
    expect(await readNotes(tmpDir, SESSION)).toBe("hello world");
  });

  it("appendNotes works", async () => {
    await appendNotes(tmpDir, SESSION, "line 2");
    const appended = await readNotes(tmpDir, SESSION);
    expect(appended).toContain("hello world");
    expect(appended).toContain("line 2");
  });
});

describe("Tools", () => {
  it("taskTool has correct shape", () => {
    const taskTool = createTasksTool(tmpDir, SESSION + "-tools", { warnCompletedTasks: 30 });
    expect(taskTool.name).toBe("pawpad_tasks");
    expect(typeof taskTool.execute).toBe("function");
    expect(taskTool.parameters).toBeDefined();
  });

  it("tasks read returns empty message", async () => {
    const taskTool = createTasksTool(tmpDir, SESSION + "-tools", { warnCompletedTasks: 30 });
    const readResult = await taskTool.execute("tc1", { action: "read" } as any);
    expect((readResult.content[0] as any).text).toContain("No tasks");
  });

  it("tasks write returns count", async () => {
    const taskTool = createTasksTool(tmpDir, SESSION + "-tools", { warnCompletedTasks: 30 });
    const writeResult = await taskTool.execute("tc2", {
      action: "write",
      tasks: [
        { id: "t1", content: "Test", status: "pending", priority: "medium" },
      ],
    } as any);
    expect((writeResult.content[0] as any).text).toContain("1 task");
  });

  it("noteTool has correct shape", () => {
    const noteTool = createNoteTool(tmpDir, SESSION + "-tools", { warnNoteChars: 10000 });
    expect(noteTool.name).toBe("pawpad_note");
  });

  it("note append and read work", async () => {
    const noteTool = createNoteTool(tmpDir, SESSION + "-tools", { warnNoteChars: 10000 });
    const appendResult = await noteTool.execute("tc3", {
      action: "append",
      content: "Remember this",
    } as any);
    expect((appendResult.content[0] as any).text).toContain("appended");

    const noteRead = await noteTool.execute("tc4", { action: "read" } as any);
    expect((noteRead.content[0] as any).text).toContain("Remember this");
  });
});

describe("Inject Hook", () => {
  it("no injection for empty session", async () => {
    const hook = createInjectHook(tmpDir);
    const emptyResult = await hook(
      { prompt: "hi", messages: [] },
      { sessionId: "empty-session" }
    );
    expect(emptyResult).toBeUndefined();
  });

  it("injects context for session with data", async () => {
    const hook = createInjectHook(tmpDir);
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
    expect(result).toBeDefined();
    expect(typeof result?.appendSystemContext).toBe("string");

    const ctx = result!.appendSystemContext!;
    expect(ctx).toContain("<pawpad>");
    expect(ctx).toContain("pawpad_tasks");
    expect(ctx).toContain("Build API");
    expect(ctx).toContain("[x]");
    expect(ctx).toContain("REST");
    expect(ctx).toContain("1/2 done");
  });

  it("no injection without sessionId", async () => {
    const hook = createInjectHook(tmpDir);
    const noSid = await hook(
      { prompt: "hi", messages: [] },
      {} as any
    );
    expect(noSid).toBeUndefined();
  });
});
