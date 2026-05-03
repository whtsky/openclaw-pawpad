# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-05-03

### Changed

- **Breaking (storage layout):** Per-session data is now keyed by OpenClaw's stable `sessionKey` (e.g. `cli:default`, `discord:channel:123`) instead of the ephemeral `sessionId`. Tasks and notes now persist across `/new` and `/reset` for the same logical session, instead of resetting on each fresh conversation.
- Storage paths changed from `<stateDir>/<sessionId>/` to `<stateDir>/<encodedSessionKey>/`, where path-unsafe characters (`:`, `/`) in the session key are replaced with `_` for the directory name.
- The `before_prompt_build` hook now bails when `sessionKey` is missing from context (previously it bailed on missing `sessionId`).

### Migration

- Read-fallback only — no automatic file moves. On read, if the new `sessionKey`-based path is empty, pawpad falls back to the legacy `sessionId`-based path. The first `write`/`append` after upgrade lands in the new path; from then on the legacy directory is unused (orphaned) and you can delete it manually if desired.
- If you want a clean cut, delete the entire pawpad state directory (`<openclaw-state-dir>/state/pawpad/`) before upgrading.

## [0.1.4] - 2026-03-23

### Changed

- Trimmed tool descriptions for `pawpad_tasks` and `pawpad_note` — removed coaching paragraphs, front-loaded the persistence value prop. Behavioral guidance now lives in the injected context instead.
- Task `id` parameter description now hints at expected format (e.g. `"t1"`, `"setup-db"`).
- Task write results now include a status summary (e.g. `"Tasks updated (5 tasks: 1 in_progress, 3 pending, 1 completed)."`).
- Injected context now wraps tasks and notes in a `<pawpad>` parent tag with a brief preamble instructing the agent to keep tasks current. Inner tags shortened from `<pawpad-tasks>`/`<pawpad-notes>` to `<tasks>`/`<notes>` since they're scoped within `<pawpad>`.

## [0.1.3] - 2026-03-23

### Changed

- Moved `openclaw` and `@mariozechner/pi-agent-core` from peer/prod dependencies to devDependencies to avoid duplicating the entire OpenClaw dependency tree (~600 MB) during `openclaw plugins install`. Only `@sinclair/typebox` remains as a runtime dependency.

## [0.1.2]

Changelog started at this version. See git history for earlier changes.
