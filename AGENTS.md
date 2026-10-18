# Project architecture
- Capture financial and engagement changes with database triggers into user-scoped, read-only activity history, so every entry path is audited.
- Record credit payments through an authenticated, row-locking transactional RPC; retain the existing paid balance to preserve older repayments.
- Render dated responsibilities from independent schedules and completion logs in daily blocks, never materializing duplicate daily tasks.
- Reuse weekly_sports for the simple calorie tracker so sport and calorie pages share the same daily totals.
- Use shared tracking controls and task-name selection across dedicated pages and the embedded work timer to keep behavior consistent.
