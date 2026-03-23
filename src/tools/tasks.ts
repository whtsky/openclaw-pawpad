/**
 * pawpad_tasks tool — read/write structured task lists.
 *
 * - "read" → returns current tasks as JSON
 * - "write" → full replacement (like Claude Code's TodoWrite)
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import {
  readTasks,
  writeTasks,
  validateTasks,
  type TasksState,
} from "../storage.js";

const TaskSchema = Type.Object({
  id: Type.String({ description: 'Unique stable short identifier (e.g. "t1", "setup-db"). Referenced by blockedBy.' }),
  content: Type.String({ description: "Brief task title in imperative form" }),
  description: Type.Optional(
    Type.String({
      description:
        "Detailed description with context and acceptance criteria",
    })
  ),
  status: Type.Union(
    [
      Type.Literal("pending"),
      Type.Literal("in_progress"),
      Type.Literal("completed"),
    ],
    { description: "Task status" }
  ),
  priority: Type.Optional(
    Type.Union(
      [Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")],
      { description: "Task priority (default: medium)" }
    )
  ),
  blockedBy: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "IDs of tasks that must complete before this one can start",
    })
  ),
});

const Parameters = Type.Object({
  action: Type.Union([Type.Literal("read"), Type.Literal("write")], {
    description: 'Action: "read" to get current tasks, or "write" to replace all tasks.',
  }),
  tasks: Type.Optional(
    Type.Array(TaskSchema, {
      description:
        'Full replacement task list (required when action is "write").',
    })
  ),
});

type Params = Static<typeof Parameters>;

function textResult(text: string): AgentToolResult<unknown> {
  return { content: [{ type: "text", text }], details: {} };
}

/** Soft warnings based on task counts. */
function getWarnings(
  tasks: Static<typeof TaskSchema>[],
  warnThreshold: number
): string[] {
  const warnings: string[] = [];
  const completed = tasks.filter((t) => t.status === "completed").length;
  if (completed > warnThreshold) {
    warnings.push(
      `⚠️ ${completed} completed tasks accumulating. Consider removing finished tasks to keep the list focused.`
    );
  }
  return warnings;
}

export function createTasksTool(
  stateDir: string,
  sessionId: string,
  cfg: { warnCompletedTasks: number }
): AgentTool<typeof Parameters> {
  return {
    name: "pawpad_tasks",
    label: "PawPad Tasks",
    description:
      "Persistent per-session task list that survives context compaction. " +
      'Use "read" to get current tasks, "write" to replace the full list. ' +
      "Each task has an id, content, status (pending/in_progress/completed), and optional priority, description, and blockedBy fields.",
    parameters: Parameters,
    async execute(
      _toolCallId: string,
      params: Params
    ): Promise<AgentToolResult<unknown>> {
      if (params.action === "read") {
        const state = await readTasks(stateDir, sessionId);
        if (state.tasks.length === 0) {
          return textResult("No tasks recorded yet.");
        }
        const warnings = getWarnings(state.tasks, cfg.warnCompletedTasks);
        const result = JSON.stringify(state, null, 2);
        return textResult(
          warnings.length > 0
            ? result + "\n\n" + warnings.join("\n")
            : result
        );
      }

      // write
      if (!params.tasks || !Array.isArray(params.tasks)) {
        return textResult("Error: tasks array is required for write action.");
      }

      // Validate all tasks before writing
      let validatedTasks;
      try {
        validatedTasks = validateTasks(params.tasks);
      } catch (e) {
        return textResult(
          `Error: Invalid task data — ${e instanceof Error ? e.message : String(e)}`
        );
      }

      const newState: TasksState = {
        tasks: validatedTasks,
        updatedAt: new Date().toISOString(),
      };

      const warnings = getWarnings(validatedTasks, cfg.warnCompletedTasks);
      await writeTasks(stateDir, sessionId, newState);
      const count = newState.tasks.length;
      const statusCounts = validatedTasks.reduce(
        (acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      const summary = (["in_progress", "pending", "completed"] as const)
        .filter((s) => statusCounts[s])
        .map((s) => `${statusCounts[s]} ${s}`)
        .join(", ");
      const msg = `Tasks updated (${count} task${count === 1 ? "" : "s"}${summary ? `: ${summary}` : ""}).`;
      return textResult(
        warnings.length > 0 ? msg + "\n\n" + warnings.join("\n") : msg
      );
    },
  };
}
