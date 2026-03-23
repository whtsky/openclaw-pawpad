# 🐾 openclaw-pawpad

Per-session task list and notes for [OpenClaw](https://github.com/openclaw/openclaw) agents.

## The problem

When OpenClaw compresses old conversation turns, your agent loses track of what it was doing — tasks, decisions, notes from earlier in the session get summarized away or lost.

## How PawPad fixes it

PawPad stores a structured task list and freeform notes on disk, outside the context window. Before every agent turn, it injects them into the system prompt. The agent sees its full task list and notes on every turn, no matter how much context has been compacted.

Data is isolated per session. Starting a new session (`/new` or `/reset`) gives you a clean slate.

## Install

```bash
openclaw plugins install openclaw-pawpad
```

Restart OpenClaw. That's it.

## Config

Optional. Most people won't need to change these.

```jsonc
// ~/.openclaw/openclaw.json
{
  "plugins": {
    "entries": {
      "openclaw-pawpad": {
        "config": {
          "warnCompletedTasks": 30,  // soft warning threshold
          "warnNoteChars": 10000     // soft warning threshold
        }
      }
    }
  }
}
```

Warnings are advisory. Nothing gets blocked or truncated.

## License

MIT
