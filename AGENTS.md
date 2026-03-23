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

## Changelog

- Maintain `CHANGELOG.md` at the project root following [Keep a Changelog](https://keepachangelog.com/) format.
- **Every user-facing change** gets an entry under `## [Unreleased]` immediately — don't wait for release time. User-facing changes include: new tools, changed behavior, storage format changes, prompt injection changes, config schema changes, bug fixes, and removed features.
- Use the standard categories: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Internal-only changes (refactors, CI tweaks, test additions) do **not** need changelog entries unless they affect plugin behavior.
- At release time: rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`, bump `version` in `package.json`, create a matching `vX.Y.Z` git tag (this triggers the publish workflow), and add a fresh empty `[Unreleased]` section.
- If a change affects compatibility or persisted data format, call that out explicitly in the changelog entry.
