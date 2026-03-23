/**
 * File-based storage for per-session tasks and notes.
 * Directory structure: <stateDir>/<sessionId>/tasks.json | notes.md
 */

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "high" | "medium" | "low";

export interface Task {
  id: string;
  content: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  blockedBy?: string[];
}

export interface TasksState {
  tasks: Task[];
  updatedAt: string;
}

// ── Session ID validation ──────────────────────────────────────────────────

// Match OpenClaw's own SAFE_SESSION_ID_RE: /^[a-z0-9][a-z0-9._-]{0,127}$/i
const SESSION_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

export function validateSessionId(id: string): string {
  if (!SESSION_ID_RE.test(id)) {
    throw new Error(`Invalid sessionId: ${id}`);
  }
  return id;
}

// ── Task validation ────────────────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(["pending", "in_progress", "completed"]);
const VALID_PRIORITIES = new Set<string>(["high", "medium", "low"]);

export function validateTask(task: unknown, index: number): Task {
  if (!task || typeof task !== "object") {
    throw new Error(`Task at index ${index} is not an object`);
  }
  const t = task as Record<string, unknown>;

  if (typeof t.id !== "string" || t.id.trim() === "") {
    throw new Error(`Task at index ${index}: id must be a non-empty string`);
  }
  if (typeof t.content !== "string" || t.content.trim() === "") {
    throw new Error(
      `Task at index ${index}: content must be a non-empty string`
    );
  }
  if (typeof t.status !== "string" || !VALID_STATUSES.has(t.status)) {
    throw new Error(
      `Task at index ${index}: status must be pending|in_progress|completed`
    );
  }
  if (t.description !== undefined && typeof t.description !== "string") {
    throw new Error(`Task at index ${index}: description must be a string`);
  }
  if (t.priority !== undefined) {
    if (typeof t.priority !== "string" || !VALID_PRIORITIES.has(t.priority)) {
      throw new Error(
        `Task at index ${index}: priority must be high|medium|low`
      );
    }
  }
  if (t.blockedBy !== undefined) {
    if (
      !Array.isArray(t.blockedBy) ||
      !t.blockedBy.every((b: unknown) => typeof b === "string")
    ) {
      throw new Error(
        `Task at index ${index}: blockedBy must be an array of strings`
      );
    }
  }

  return {
    id: t.id as string,
    content: t.content as string,
    status: t.status as TaskStatus,
    ...(t.description !== undefined && {
      description: t.description as string,
    }),
    ...(t.priority !== undefined && { priority: t.priority as TaskPriority }),
    ...(t.blockedBy !== undefined && { blockedBy: t.blockedBy as string[] }),
  };
}

export function validateTasks(tasks: unknown[]): Task[] {
  const validated = tasks.map((t, i) => validateTask(t, i));
  // Check for duplicate IDs
  const seen = new Set<string>();
  for (const t of validated) {
    if (seen.has(t.id)) {
      throw new Error(`Duplicate task id: "${t.id}"`);
    }
    seen.add(t.id);
  }
  return validated;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sessionDir(stateDir: string, sessionId: string): string {
  return path.join(stateDir, validateSessionId(sessionId));
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Atomic write: write to .tmp then rename. */
async function atomicWrite(
  filePath: string,
  data: string
): Promise<void> {
  const tmp = filePath + ".tmp";
  await writeFile(tmp, data, "utf-8");
  await rename(tmp, filePath);
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export async function readTasks(
  stateDir: string,
  sessionId: string
): Promise<TasksState> {
  try {
    const p = path.join(sessionDir(stateDir, sessionId), "tasks.json");
    const raw = await readFile(p, "utf-8");
    return JSON.parse(raw) as TasksState;
  } catch (err: unknown) {
    // File not found is expected (new session) — return empty
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return { tasks: [], updatedAt: "" };
    }
    // Other errors (corruption, permissions) — log warning, return empty
    console.warn("[pawpad] Failed to read tasks:", err);
    return { tasks: [], updatedAt: "" };
  }
}

export async function writeTasks(
  stateDir: string,
  sessionId: string,
  state: TasksState
): Promise<void> {
  const dir = sessionDir(stateDir, sessionId);
  await ensureDir(dir);
  await atomicWrite(
    path.join(dir, "tasks.json"),
    JSON.stringify(state, null, 2)
  );
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function readNotes(
  stateDir: string,
  sessionId: string
): Promise<string> {
  try {
    const p = path.join(sessionDir(stateDir, sessionId), "notes.md");
    return await readFile(p, "utf-8");
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return "";
    }
    console.warn("[pawpad] Failed to read notes:", err);
    return "";
  }
}

export async function writeNotes(
  stateDir: string,
  sessionId: string,
  content: string
): Promise<void> {
  const dir = sessionDir(stateDir, sessionId);
  await ensureDir(dir);
  await atomicWrite(path.join(dir, "notes.md"), content);
}

export async function appendNotes(
  stateDir: string,
  sessionId: string,
  content: string
): Promise<void> {
  const existing = await readNotes(stateDir, sessionId);
  const newContent = existing
    ? existing.trimEnd() + "\n\n" + content
    : content;
  await writeNotes(stateDir, sessionId, newContent);
}
