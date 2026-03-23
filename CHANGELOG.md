# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.3] - 2026-03-23

### Changed

- Moved `openclaw` and `@mariozechner/pi-agent-core` from peer/prod dependencies to devDependencies to avoid duplicating the entire OpenClaw dependency tree (~600 MB) during `openclaw plugins install`. Only `@sinclair/typebox` remains as a runtime dependency.

## [0.1.2]

Changelog started at this version. See git history for earlier changes.
