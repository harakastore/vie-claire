# Project architecture
- Capture financial and engagement changes with database triggers into user-scoped, read-only activity history, so every entry path is audited.
- Record and correct credit payments through authenticated, credit-row-locking transactional RPCs; apply correction deltas to retain older repayments and audit payment updates.
- Render dated responsibilities from independent schedules and completion logs in daily blocks, never materializing duplicate daily tasks.
- Keep retired section data intact and redirect their former routes to active related pages, so existing bookmarks remain usable.
- Share responsibility completion logs across the date-range tracker, individual history and daily blocks; invalidate sibling views after updates to keep checkboxes synchronized.
- Keep learning editing in a modal and sport entry/history behind exercise-level dialogs, so overview pages stay focused.
- Use the explicit calorie-entry flag for calorie summaries, so default-zero sports schedules are not counted as food logs.
- Use shared tracking controls and task-name selection across dedicated pages and the embedded work timer to keep behavior consistent.
