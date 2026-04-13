---
description: Load project context at session start. Reads CODEBASE.md, recent changes, and project state for quick onboarding. Creates a new temp branch.
---

# /load-context - Load Session Context

$ARGUMENTS

---

## Purpose

Quickly load the project context at the start of a new AI session. Reads key documentation, recent git history, project state, and creates a new working branch from `main`.

---

## Sub-commands

```
/load-context          - Full context load + create temp branch
/load-context quick    - Quick load: CODEBASE.md + recent git log only
/load-context deep     - Deep load: full architecture scan + dependency analysis
```

---

## Steps

### 1. Pull latest from main
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/Taskapp && git checkout main && git pull origin main 2>&1
```

### 2. Create new working branch
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/Taskapp && git checkout -b "$(date +%Y%m%d-%H%M)-temp"
```
> **Branch format:** `yyyymmdd-hhmm-temp`, e.g. `20260301-1713-temp`

### 3. Read CODEBASE.md
// turbo
```bash
cat /Users/buiminhkhoi/Documents/Antigravity/Taskapp/CODEBASE.md 2>/dev/null || echo "⚠️ CODEBASE.md not found. Run /save-context first."
```

### 4. Read session notes
// turbo
```bash
cat /Users/buiminhkhoi/Documents/Antigravity/Taskapp/docs/SESSION_NOTES.md 2>/dev/null || echo "No session notes found."
```

### 5. Check recent git history
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/Taskapp && git log --oneline -20
```

### 6. Check current branch and status
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/Taskapp && git branch --show-current && git status --short
```

### 7. Scan project structure
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/Taskapp && find src -type f \( -name "*.ts" -o -name "*.tsx" \) | sort
```
> **Adapt:** Change file extensions based on project language (`.py`, `.go`, `.rs`, `.jsx`, etc.)

### 8. Check running services
// turbo
```bash
lsof -i :5173 -i :3000 -i :4000 -i :8080 2>/dev/null | head -5 || echo "No dev servers running"
```
> **Adapt:** Change port numbers based on the framework's dev server port.

### 9. (Deep mode only) Read key architecture files

If `/load-context deep`, read the most important files:
- Main entry point (e.g. `App.tsx`, `main.py`, `main.go`)
- Service/business logic files
- Configuration files (build config, deploy config)
- Backend entry points (if applicable)

---

## Branch Strategy

```
main (production)
  │
  ├── 20260301-1713-temp   ← /load-context creates this
  │     │
  │     ├── work, work, work...
  │     │
  │     └── /save-context  ← merges to main + push
  │
  ├── 20260302-0900-temp   ← next session
  │     └── ...
```

> **Note:** When running `/sync` or `/save-context`, changes from the temp branch will be merged into `main` before pushing:
> ```bash
> git checkout main && git merge <temp-branch> && git push origin main
> ```

---

## Output Format

```markdown
## 🧠 Context Loaded

### Project: TaskApp
- **Stack:** Vite + React 19 + JavaScript
- **Deploy:** https://taskapp.vercel.app

### Working Branch
- **Created:** `20260301-1713-temp` from `main`

### Recent Activity (last 5 commits)
- `abc1234` feat: ...
- `def5678` fix: ...

### Current State
- **Branch:** 20260301-1713-temp
- **Uncommitted changes:** none
- **Dev server:** running on :5173 / not running

### Ready to work! What would you like to do?
```

---

## When to Use

| Scenario | Command |
|----------|---------|
| New session, quick start | `/load-context quick` |
| New session, full understanding needed | `/load-context` |
| Unfamiliar with codebase, need deep dive | `/load-context deep` |
| After pulling changes from remote | `/load-context` |
