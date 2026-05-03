/**
 * File-based storage for per-session tasks and notes.
 *
 * Primary key is `sessionKey` (OpenClaw's stable session identifier — survives
 * /new and /reset). For backwards compat with v0.1.x data keyed by the
 * ephemeral `sessionId`, read fns accept an optional `legacySessionId` and
 * fall back to that path on ENOENT. Writes always go to the sessionKey path.
 *
 * Directory structure: <stateDir>/<encodedSessionKey>/tasks.json | notes.md
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

// ── Session key validation & encoding ──────────────────────────────────────

// sessionKey may contain `:` (e.g. `discord:channel:123`) and `/`. Allow the
// charset OpenClaw can produce; reject anything that could traverse paths or
// inject control bytes.
const SESSION_KEY_RE = /^[a-zA-Z0-9._:/-]{1,256}$/;

// Legacy ephemeral sessionId regex — mirrors OpenClaw's SAFE_SESSION_ID_RE.
const LEGACY_SESSION_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

export function encodeSessionKey(key: string): string {
  if (!SESSION_KEY_RE.test(key)) {
    throw new Error(`Invalid sessionKey: ${key}`);
  }
  // Replace path-unsafe chars with "_" for the on-disk directory name.
  return key.replace(/[:/]/g, "_");
}

export function validateLegacySessionId(id: string): string {
  if (!LEGACY_SESSION_ID_RE.test(id)) {
    throw new Error(`Invalid legacy sessionId: ${id}`);
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

function sessionDir(stateDir: string, sessionKey: string): string {
  return path.join(stateDir, encodeSessionKey(sessionKey));
}

function legacyDir(stateDir: string, sessionId: string): string {
  return path.join(stateDir, validateLegacySessionId(sessionId));
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

function isENOENT(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}

/**
 * Read a file at the sessionKey path, falling back to the legacy sessionId
 * path when the primary is missing. Returns `undefined` when nothing exists
 * or any read fails for non-ENOENT reasons (logged).
 */
async function readWithFallback(
  stateDir: string,
  sessionKey: string,
  legacySessionId: string | undefined,
  filename: string
): Promise<string | undefined> {
  try {
    return await readFile(path.join(sessionDir(stateDir, sessionKey), filename), "utf-8");
  } catch (err) {
    if (!isENOENT(err)) {
      console.warn(`[pawpad] Failed to read ${filename}:`, err);
      return undefined;
    }
  }
  if (!legacySessionId) return undefined;
  try {
    return await readFile(path.join(legacyDir(stateDir, legacySessionId), filename), "utf-8");
  } catch (err) {
    if (!isENOENT(err)) {
      console.warn(`[pawpad] Failed to read legacy ${filename}:`, err);
    }
    return undefined;
  }
}

// ── Tasks ──────────────────────────────────────────────────────────────────

const EMPTY_TASKS: TasksState = { tasks: [], updatedAt: "" };

export async function readTasks(
  stateDir: string,
  sessionKey: string,
  legacySessionId?: string
): Promise<TasksState> {
  const raw = await readWithFallback(stateDir, sessionKey, legacySessionId, "tasks.json");
  if (raw === undefined) return EMPTY_TASKS;
  try {
    return JSON.parse(raw) as TasksState;
  } catch (err) {
    console.warn("[pawpad] Failed to parse tasks.json:", err);
    return EMPTY_TASKS;
  }
}

export async function writeTasks(
  stateDir: string,
  sessionKey: string,
  state: TasksState
): Promise<void> {
  const dir = sessionDir(stateDir, sessionKey);
  await ensureDir(dir);
  await atomicWrite(
    path.join(dir, "tasks.json"),
    JSON.stringify(state, null, 2)
  );
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function readNotes(
  stateDir: string,
  sessionKey: string,
  legacySessionId?: string
): Promise<string> {
  const raw = await readWithFallback(stateDir, sessionKey, legacySessionId, "notes.md");
  return raw ?? "";
}

export async function writeNotes(
  stateDir: string,
  sessionKey: string,
  content: string
): Promise<void> {
  const dir = sessionDir(stateDir, sessionKey);
  await ensureDir(dir);
  await atomicWrite(path.join(dir, "notes.md"), content);
}

export async function appendNotes(
  stateDir: string,
  sessionKey: string,
  content: string,
  legacySessionId?: string
): Promise<void> {
  const existing = await readNotes(stateDir, sessionKey, legacySessionId);
  const newContent = existing
    ? existing.trimEnd() + "\n\n" + content
    : content;
  await writeNotes(stateDir, sessionKey, newContent);
}
