/**
 * pawpad_note tool — read/write/append freeform scratchpad notes.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { readNotes, writeNotes, appendNotes } from "../storage.js";

const Parameters = Type.Object({
  action: Type.Union(
    [Type.Literal("read"), Type.Literal("write"), Type.Literal("append")],
    {
      description:
        '"read" to get notes, "write" to replace, "append" to add to end.',
    }
  ),
  content: Type.Optional(
    Type.String({
      description:
        'Note content (required for "write" and "append" actions).',
    })
  ),
});

type Params = Static<typeof Parameters>;

function textResult(text: string): AgentToolResult<unknown> {
  return { content: [{ type: "text", text }], details: {} };
}

export function createNoteTool(
  stateDir: string,
  sessionId: string,
  cfg: { warnNoteChars: number }
): AgentTool<typeof Parameters> {
  return {
    name: "pawpad_note",
    label: "PawPad Note",
    description:
      "Read, write, or append to the per-session scratchpad. Use for freeform notes, context, decisions, or anything worth remembering within this session. " +
      "Notes survive context compaction and are auto-injected into every prompt.\n\n" +
      "Use this tool to preserve important context that would otherwise be lost during compaction: " +
      "key decisions and their reasoning, user preferences discovered during conversation, intermediate results, " +
      "and constraints. Information stored here persists across compaction cycles.",
    parameters: Parameters,
    async execute(
      _toolCallId: string,
      params: Params
    ): Promise<AgentToolResult<unknown>> {
      if (params.action === "read") {
        const notes = await readNotes(stateDir, sessionId);
        if (!notes) return textResult("No notes recorded yet.");
        const warning =
          notes.length > cfg.warnNoteChars
            ? `\n\n⚠️ Notes are ${notes.length} characters. Consider condensing to keep context focused.`
            : "";
        return textResult(notes + warning);
      }

      if (params.content == null) {
        return textResult(
          `Error: content is required for ${params.action} action.`
        );
      }

      if (params.action === "write") {
        await writeNotes(stateDir, sessionId, params.content);
        const warning =
          params.content.length > cfg.warnNoteChars
            ? `\n⚠️ Notes are ${params.content.length} characters. Consider condensing.`
            : "";
        return textResult("Notes updated." + warning);
      }

      // append
      await appendNotes(stateDir, sessionId, params.content);
      const total = await readNotes(stateDir, sessionId);
      const warning =
        total.length > cfg.warnNoteChars
          ? `\n⚠️ Notes are now ${total.length} characters. Consider condensing.`
          : "";
      return textResult("Notes appended." + warning);
    },
  };
}
