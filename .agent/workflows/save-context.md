---
description: Save current session context for future conversations. Updates CODEBASE.md, architecture docs, and session notes, then runs /sync.
---

# /save-context - Save Session Context

$ARGUMENTS

---

## Purpose

Persist the current working context (architecture decisions, recent changes, known issues) so that future AI sessions can quickly resume — then run the full `/sync` workflow to commit and push everything.

---

## Sub-commands

```
/save-context          - Full context save + /sync
/save-context quick    - Quick save: update recent changes only + /sync
/save-context --no-sync - Save context files without syncing
```

---

## Steps

### Phase 1: Save Context

#### 1.1 Scan current project state
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/Taskapp && find src -type f \( -name "*.ts" -o -name "*.tsx" \) | sort
```

#### 1.2 Check recent git history
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/Taskapp && git log --oneline -10
```

#### 1.3 Update CODEBASE.md

Update or create `CODEBASE.md` at the project root with:

```markdown
# CODEBASE.md - TaskApp

> Last updated: <current_date>

## Project Overview
- **Type:** Vite + React 19 + JavaScript
- **Purpose:** <brief description>
- **Deployment:** <deploy platform + method>
- **URL:** https://taskapp.vercel.app

## Key Architecture

### Directory Structure
<list key directories and their purpose>

### Key Files
<list the most important files and their roles>

### Key Services/Modules
<list business logic modules>

## File Dependencies
<analyze and list key file dependencies>

## Recent Changes
<list recent significant changes from git log>

## Known Issues / TODOs
<list any known issues or pending work>

## Environment
- **Repo:** https://github.com/khoibmtn/Taskapp.git
- **Deploy:** https://taskapp.vercel.app
```

> **Important:** Adapt the template above to match the actual project structure. The sections listed are suggestions — add, remove, or rename as needed.

#### 1.4 Save session notes

Create/update `docs/SESSION_NOTES.md`:

```markdown
# Session Notes

## Session <date>

### What was done
- <list changes made in this session>

### Decisions made
- <list architectural/design decisions>

### Pending items
- <list items left unfinished>

### Key files modified
- <list files with significant changes>
```

---

### Phase 2: Run /sync

After saving context files, execute the full `/sync` workflow:

1. **Pre-flight checks** (TypeScript, ESLint, Tests, Build, Security, Secrets, Console.log, Bundle)
2. **Stage all changes** including CODEBASE.md and SESSION_NOTES.md
3. **Commit** with message: `docs: save session context + <summary>`
4. **Push to main** → triggers auto-deploy
5. **Health check** → verify site is up

> Refer to `/sync` workflow for detailed steps.

---

## What to Include in Context

| Category | Examples |
|----------|----------|
| **Architecture** | Component structure, data flow, API patterns |
| **Decisions** | Why certain libraries/patterns were chosen |
| **State** | Current feature status, what works, what doesn't |
| **Dependencies** | File dependencies, import relationships |
| **Config** | Environment variables, deployment settings |
| **Issues** | Known bugs, workarounds, technical debt |

---

## Output Format

```markdown
## 💾 Context Saved & Synced

### Context
- **CODEBASE.md** — Updated project overview + architecture
- **docs/SESSION_NOTES.md** — Session changes logged

### Sync
- ✅ Pre-flight checks passed
- **Commit:** `abc1234` — docs: save session context
- **Pushed to:** main
- **Deploy:** Auto-deploying
```
