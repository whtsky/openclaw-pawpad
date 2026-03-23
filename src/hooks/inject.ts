/**
 * before_prompt_build hook — injects tasks & notes into system prompt.
 *
 * Returns appendSystemContext so it gets cached by providers.
 * No truncation — all tasks and notes are injected as-is.
 * Tasks are sorted: in_progress first, then pending (high → medium → low), then completed.
 */

import { readTasks, readNotes, type Task } from "../storage.js";

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  pending: 1,
  completed: 2,
};

function taskSortKey(task: Task): [number, number] {
  const statusRank = STATUS_ORDER[task.status] ?? 9;
  const priorityRank = PRIORITY_ORDER[task.priority ?? "medium"] ?? 1;
  return [statusRank, priorityRank];
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const [aStatus, aPriority] = taskSortKey(a);
    const [bStatus, bPriority] = taskSortKey(b);
    if (aStatus !== bStatus) return aStatus - bStatus;
    return aPriority - bPriority;
  });
}

function renderTask(task: Task): string {
  const check = task.status === "completed" ? "x" : " ";
  const prefix = task.status === "in_progress" ? "🔄 " : "";
  const priority = task.priority ? `(${task.priority}) ` : "";
  const blocked =
    task.blockedBy && task.blockedBy.length > 0
      ? ` 🔒 blocked by: ${task.blockedBy.join(", ")}`
      : "";
  const desc = task.description ? `\n  ${task.description}` : "";
  return `- [${check}] ${priority}${prefix}${task.content}${blocked}${desc}`;
}

function buildInjection(tasks: Task[], notes: string): string {
  const header = "## 🐾 PawPad — Session Tasks & Notes";

  let taskSection = "";
  if (tasks.length > 0) {
    const sorted = sortTasks(tasks);
    const completed = tasks.filter((t) => t.status === "completed").length;
    taskSection =
      `### Tasks (${completed}/${tasks.length} done)\n` +
      sorted.map(renderTask).join("\n");
  }

  let noteSection = "";
  if (notes.trim()) {
    noteSection = "### Notes\n" + notes.trim();
  }

  if (!taskSection && !noteSection) return "";

  return [header, taskSection, noteSection].filter(Boolean).join("\n\n");
}

export function createInjectHook(stateDir: string) {
  return async (
    event: { prompt: string; messages: unknown[] },
    ctx: { sessionId?: string }
  ): Promise<{ appendSystemContext?: string } | void> => {
    const sessionId = ctx.sessionId;
    if (!sessionId) return;

    const [tasksState, notes] = await Promise.all([
      readTasks(stateDir, sessionId),
      readNotes(stateDir, sessionId),
    ]);

    const injection = buildInjection(tasksState.tasks, notes);
    if (!injection) return;

    return { appendSystemContext: injection };
  };
}
