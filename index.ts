import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createTasksTool } from "./src/tools/tasks.js";
import { createNoteTool } from "./src/tools/note.js";
import { createInjectHook } from "./src/hooks/inject.js";

export type PawPadConfig = {
  warnCompletedTasks?: number;
  warnNoteChars?: number;
};

const DEFAULT_CONFIG: Required<PawPadConfig> = {
  warnCompletedTasks: 30,
  warnNoteChars: 10000,
};

export default {
  id: "openclaw-pawpad",
  name: "PawPad",
  description: "Per-session task tracking and scratchpad notes. Survives context compaction.",
  register(api: OpenClawPluginApi) {
    const baseStateDir = api.runtime.state.resolveStateDir();
    const stateDir = path.join(baseStateDir, "state", "pawpad");
    const cfg = { ...DEFAULT_CONFIG, ...(api.pluginConfig as PawPadConfig) };

    api.registerTool(
      ((ctx: { sessionKey?: string; sessionId?: string }) => {
        const sessionKey = ctx.sessionKey ?? "default";
        return createTasksTool(stateDir, sessionKey, ctx.sessionId, cfg);
      }) as Parameters<typeof api.registerTool>[0],
      { name: "pawpad_tasks" }
    );

    api.registerTool(
      ((ctx: { sessionKey?: string; sessionId?: string }) => {
        const sessionKey = ctx.sessionKey ?? "default";
        return createNoteTool(stateDir, sessionKey, ctx.sessionId, cfg);
      }) as Parameters<typeof api.registerTool>[0],
      { name: "pawpad_note" }
    );

    api.on("before_prompt_build", createInjectHook(stateDir));
  },
};
