# Update Project Status

Update STATUS.log with current date, stage, and recent progress, then sync to STATUS.md and the master status file.

## Skills Referenced
- `loglog`: Loglog format syntax and conventions

## Input

Optional arguments:
- `--stage <stage>` — override the current stage (e.g., `--stage mvp`)
- `--mode <mode>` — override development mode (`claude`, `manual`, `hybrid`)
- A free-text description of recent progress (e.g., "Added MENA country data for 2010-2020")

If no arguments, update only the "Last Updated" date and prompt for a progress note.

## Valid Stages (from CLAUDE.md)
1. `initial_setup`
2. `poc` (Proof of Concept)
3. `mvp` (Minimum Viable Product)
4. `beta`
5. `production_ready`
6. `maintenance`

## Process

### Step 1 — Read current STATUS.log

Read `STATUS.log` to understand:
- Current stage
- Current development mode
- Last updated date
- Existing recent progress entries

### Step 2 — Determine updates

Ask the user (or use provided arguments) for:
1. **Today's progress note**: What was accomplished in this session? (1–2 sentences)
2. **Stage change?**: Is the stage changing? (If not, keep current)
3. **Mode change?**: Is the development mode changing?
4. **Blockers**: Any new blockers to note?

If called with just a progress description as argument, use that as the progress note without asking.

### Step 3 — Update STATUS.log

Edit `STATUS.log`:
1. Update `Last Updated: YYYY-MM-DD` to today's date (2026-02-28)
2. If stage changed: check off the completed stage with `[x]` and mark next stage
3. Update `Development Mode` field if changed
4. Add a new progress entry under `Recent Progress`:
   ```
   - 2026-02-28: <progress note>
   ```
5. Update `Active Tasks` and `Blockers` if relevant

Keep the loglog format (dashes, 4-space indentation). Do not change the file structure.

### Step 4 — Convert to markdown

```bash
loglog STATUS.log > STATUS.md
```

### Step 5 — Sync master status file

```bash
/home/k1/public/update_project_status.sh
```

Report the output of this command.

### Step 6 — Confirm

Report:
```
STATUS.log updated:
  Last Updated: 2026-02-28
  Stage: <current stage>
  Mode: <development mode>
  Progress note added: "<note>"

STATUS.md regenerated.
Master status synced.
```

## Arguments

$ARGUMENTS
