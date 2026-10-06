# Start here (for Ved)

This pack is everything Claude Code needs to build Footnote, the second
version of InsightPilot. You do the five steps below once. After that the
routine is: `/next`, look at the result, `/clear`, repeat.

## Set up, once

1. **Create an empty GitHub repository** (suggested name `footnote`) and clone
   it. Keep the InsightPilot repository as it is; it is the "before" in your
   case study.

2. **Copy the pack into the clone from the terminal**, not by dragging in
   Finder. The pack has hidden folders (`.claude`, `.githooks`) that Finder
   does not show and may leave behind.

   ```bash
   unzip footnote-spec-pack.zip -d /tmp/footnote-pack
   cp -R /tmp/footnote-pack/. ~/path/to/footnote/
   ls -a ~/path/to/footnote      # you should see .claude and .githooks
   ```

3. **Check your git identity** inside the clone. The email must be one that is
   on your GitHub account, or the commits will not count as yours.

   ```bash
   git config --get user.name
   git config --get user.email
   ```

4. **Open Claude Code in the folder.** Choose Opus and medium effort.

5. **Type `/next`.** The first task (T00) checks the repository, switches on
   the commit hook, makes the first commit, and lists the skills and MCP
   servers you have installed so later tasks use them.

## The routine

- `/next` does one task, tests it, writes the handoff, pushes and stops.
- Read the few lines it gives you at the end. Open the site or the screenshots
  if it was an interface task.
- `/clear`, then `/next` again. The project state is shown to each new session
  automatically, so you do not need to explain anything.
- `/progress` tells you where things stand at any time.
- `/audit` in a fresh session reviews the last finished task critically. Worth
  running at the end of each phase.
- `/handoff` if you need to stop a session halfway.

## Effort setting

Medium is right for most tasks. Switch to high for these, where a subtle
mistake costs the most: T02, T03, T12, T20, T22, T24, T30, T41, T42, T45, T50,
T53, T54, T57, T73. Each task says its level at the top.

## When it will need you

| Task | What you do |
|---|---|
| T00 | Confirm the name and email it reports are yours on GitHub |
| T53 | Decide whether to add a free Gemini key. Optional. See below |
| T55, T57 | Live eval runs need that key. Without it these parts are skipped |
| T75 | Import the repository into Vercel (Hobby plan) and confirm the URL |

## The Gemini key, if you want one

Footnote works fully without it. The key adds free-text questions.

- Create it in Google AI Studio on a Google project that has **no billing
  account**. That is what guarantees it can never charge you.
- Put it in `.env.local` yourself as `GEMINI_API_KEY=...`. Do not paste it
  into the chat.
- The free tier may use what is sent to improve Google's products. Footnote
  sends column names, a few category values and aggregated results, never your
  rows, and only when AI assist is switched on.

## What is in the pack

| File | Purpose |
|---|---|
| `CLAUDE.md` | Loaded into every session: the one-task loop, the rules, the git rules |
| `docs/requirements.md` | What to build and why, with requirement IDs |
| `docs/architecture.md` | Structure, the seven invariants, the contracts |
| `docs/analytics-spec.md` | Every rule and formula, and the sample data with planted effects |
| `docs/evals.md` | The 80 test questions, scoring, and the rules that keep the score honest |
| `docs/ui-ux-rules.md` | The design language and how each screen is checked |
| `docs/steps.md` | 45 tasks, one per session, with a board of what is done |
| `docs/progress.md` | The handoff log every agent reads first and writes last |
| `docs/decisions.md` | Decisions already made, open questions, ideas for later |
| `.claude/settings.json` | Turns off commit attribution; common permissions; the session hook |
| `.claude/skills/` | `/next`, `/handoff`, `/progress`, `/audit` |
| `.claude/hooks/session-context.sh` | Shows the project state at the start of each session |
| `.githooks/commit-msg` | Removes any co-author or tool line from every commit |

## Three things worth knowing

- **The name is yours to change.** Footnote is a working name; no trademark or
  domain check was done. It lives in one config file.
- **Commits stay small and real.** The rules ask for a commit and push after
  each verified step, which gives you plenty of history. They also forbid
  padding, because a reviewer who opens the log reads the messages.
- **Read the explainers.** Ten tasks write a short note in `docs/learn/` on
  what was built and the questions an interviewer might ask about it. That is
  how you stay able to defend everything in the project.
