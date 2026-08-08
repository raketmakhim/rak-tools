# rak-tools

Personal CLI toolbox. Subcommand-based: `rak <command>`.

## Prerequisites

- Node.js 21+ (`import.meta.dirname` support)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm i -g @anthropic-ai/claude-code`)
- [GitHub CLI](https://cli.github.com/) (`winget install GitHub.cli`, then `gh auth login`)

## Install

```bash
git clone https://github.com/raketmakhim/rak-tools.git
cd rak-tools
npm link
```

`npm link` symlinks the `rak` binary globally. Works immediately from any directory, any terminal. Changes to the source take effect without reinstalling.

To uninstall: `npm unlink -g rak-tools`

## Commands

### `rak commit`

AI-generated commit messages via Claude, then pushes.

1. Staged changes exist &rarr; uses them. Nothing staged &rarr; stages everything (`git add -A`).
2. Pipes `git diff --cached` to Claude to generate a conventional commit message.
3. Displays the message. Prompts: `y` accept, `n` cancel, `e` edit manually.
4. Commits and pushes. Sets upstream automatically on first push.
5. Results are cached &mdash; re-running on the same diff skips the AI call.

### `rak pr`

AI-generated pull request via Claude + GitHub CLI.

1. Detects uncommitted changes &rarr; offers to run `rak commit` first.
2. Guards: must be on a feature branch.
3. Pushes branch to origin if not already pushed.
4. Gathers all commits and diff since divergence from default branch.
5. Pipes to Claude to generate a PR title and body.
6. Displays the proposal. Prompts: `y` create, `n` cancel, `e` edit title.
7. If PR already exists, updates the title and body instead of creating a new one.

### `rak branch`

AI-suggested branch name from uncommitted changes.

1. Detects uncommitted changes (staged, unstaged, untracked).
2. Pipes the diff to Claude to suggest a kebab-case branch name.
3. Displays the suggestion. Prompts: `y` accept, `n` cancel, `e` edit manually.
4. Runs `git checkout -b <name>` &mdash; changes carry over to the new branch.
5. Results are cached &mdash; re-running on the same diff skips the AI call.

### `rak review`

AI code review of current changes via Claude.

1. On a feature branch &rarr; diffs all committed + uncommitted changes against the default branch.
2. On the default branch &rarr; diffs uncommitted changes only.
3. Pipes the diff to Claude for review. Findings are categorized: `[BUG]` `[SECURITY]` `[PERF]` `[SUGGESTION]` `[STYLE]`.
4. Output is color-coded: bugs/security in red, perf in yellow, suggestions in green, style in grey.
5. Results are cached &mdash; re-running on the same diff skips the AI call.

### `rak slim [file|all]`

AI-powered code slimming &mdash; finds ways to shorten and simplify code.

- `rak slim <file>` &mdash; analyzes that file for redundancy, verbosity, and over-abstraction.
- `rak slim all` &mdash; analyzes every tracked code file in the repo, one by one.
- `rak slim` (no args) &mdash; analyzes the current branch diff (same scope as `rak review`).

Outputs `[CUT]` findings ranked by impact, each with before/after snippets. Focuses only on making code leaner &mdash; no style or naming suggestions.

### `rak rebase`

Rebases current branch onto the default branch with AI-powered conflict resolution.

1. Fetches latest default branch from origin.
2. Runs `git rebase origin/<default>`.
3. If conflicts occur, lists conflicted files and offers to resolve with Claude.
4. For each file: shows the AI-proposed resolution, prompts to accept or skip.
5. Handles multi-commit rebases &mdash; loops through each conflict stop automatically.
6. Once all conflicts are resolved, continues the rebase.
7. On the default branch: just pulls latest.

### `rak history <file>`

Interactive git history viewer for a single file.

1. Shows all commits that touched the given file, newest first.
2. Displays hash, message, author, and relative date.
3. Enter a number to view the full diff for that commit.

### `rak clean`

Deletes local branches whose PRs were merged on GitHub.

1. Runs `git fetch --prune` to sync with remote.
2. Checks each local branch against GitHub via `gh pr view` &mdash; only targets branches with a `MERGED` PR.
3. Lists matched branches for confirmation. Current branch and default branch are always kept.
4. Deletes with `git branch -d`, falls back to `-D` for squash-merged branches.

## Caching

Commands that call Claude (`commit`, `branch`, `review`) cache results keyed by a hash of their input diff. Re-running the same command with no code changes returns the cached result instantly without an AI call. Any change to the diff invalidates the cache automatically. Cache is stored in `%TEMP%/rak-cache/`.

## Adding commands

Drop a file in `commands/`. Filename becomes the subcommand.

```
commands/example.mjs  →  rak example
```

Export a default async function:

```js
export default async function example() {
  // ...
}
```

Shared utilities (`run`, `prompt`, colors, `getDefaultBranch`) are in `util.mjs`. Cache helpers (`getCached`, `setCached`) are in `cache.mjs`.

No registration needed &mdash; the router discovers commands by filename.

## Structure

```
cli.mjs              Entry point (rak binary)
util.mjs             Shared helpers (run, prompt, colors, getDefaultBranch)
cache.mjs            Per-command result caching
commands/
  branch.mjs         rak branch
  clean.mjs          rak clean
  commit.mjs         rak commit
  history.mjs        rak history
  pr.mjs             rak pr
  rebase.mjs         rak rebase
  review.mjs         rak review
  slim.mjs           rak slim
package.json
```
