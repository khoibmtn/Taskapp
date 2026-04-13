---
description: Execute a Superpowers implementation plan with structured checkpoints
---

# Superpowers Execute

Use this workflow to execute an approved implementation plan using the Superpowers methodology.

## Steps

1. Read the executing-plans skill:
   Use `view_file` to read the skill at the superpowers installation path: `skills/executing-plans/SKILL.md`

2. Read the Antigravity tool mapping:
   Use `view_file` to read `skills/using-superpowers/references/antigravity-tools.md`

3. Follow the executing-plans skill instructions exactly:
   - Execute tasks in batches with human checkpoints
   - Use `task_boundary` to track progress through each task
   - Update `task.md` artifact as tasks are completed
   - Request code review between tasks using the requesting-code-review skill

4. When tool names in the skill reference Claude Code tools, use the Antigravity equivalents from the tool mapping.

**Important:** Do NOT use `browser_subagent` for code implementation tasks. Antigravity does not support general-purpose subagents. Execute all tasks sequentially in the current session.
