# rak-tools

Personal CLI toolbox. Subcommand-based: `rak <command>`.

## Prerequisites

- Node.js 18+
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

### `rak clean`

Deletes local branches whose PRs were merged on GitHub.

1. Runs `git fetch --prune` to sync with remote.
2. Checks each local branch against GitHub via `gh pr view` &mdash; only targets branches with a `MERGED` PR.
3. Lists matched branches for confirmation. Current branch and default branch are always kept.
4. Deletes with `git branch -d`, falls back to `-D` for squash-merged branches.

### `rak slim [file]`

AI-powered code slimming &mdash; finds ways to shorten and simplify code.

- `rak slim <file>` &mdash; analyzes that file for redundancy, verbosity, and over-abstraction.
- `rak slim all` &mdash; analyzes every tracked code file in the repo, one by one.
- `rak slim` (no args) &mdash; analyzes the current branch diff (same scope as `rak review`).

Outputs `[CUT]` findings ranked by impact, each with before/after snippets. Focuses only on making code leaner &mdash; no style or naming suggestions.

## Adding commands

Drop a file in `commands/`. Filename becomes the subcommand.

```
commands/rebase.mjs  →  rak rebase
commands/sync.mjs    →  rak sync
```

Export a default async function:

```js
export default async function rebase() {
  // ...
}
```

No registration needed &mdash; the router discovers it by filename.

## Structure

```
cli.mjs              Entry point (rak binary)
commands/
  branch.mjs         rak branch
  clean.mjs          rak clean
  commit.mjs         rak commit
  history.mjs        rak history
  pr.mjs             rak pr
  review.mjs         rak review
  slim.mjs           rak slim
package.json
```
