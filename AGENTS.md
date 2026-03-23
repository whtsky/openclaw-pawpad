# openclaw-pawpad

OpenClaw plugin that provides per-session task tracking and scratchpad notes.
Tasks and notes are stored on disk and re-injected into every prompt via the `before_prompt_build` hook, so they survive context compaction.

## Key Design Decisions

- This is a **plugin** (not a skill or context engine). Use `api.registerTool()` for tools and `api.on()` for hooks — never `registerContextEngine`.
- Use `sessionId` (ephemeral, changes on `/new`) not `sessionKey` for per-conversation isolation.
- Storage paths: `<stateDir>/<sessionId>/tasks.json` and `<stateDir>/<sessionId>/notes.md`. Use `api.runtime.state.resolveStateDir()` to get the base.
- Injection uses `appendSystemContext` (not `prependSystemContext`) so it gets cached by providers.
- No truncation — all tasks and notes are injected as-is. Soft warnings nudge the agent to clean up, but nothing is enforced.
- All file I/O is async with graceful ENOENT handling.
- The plugin should work with any context engine (legacy or LCM).
