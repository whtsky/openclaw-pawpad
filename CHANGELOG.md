# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
