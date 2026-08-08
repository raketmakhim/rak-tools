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

**Flow:**
1. Staged changes exist &rarr; uses them. Nothing staged &rarr; stages everything (`git add -A`).
2. Pipes `git diff --cached` to Claude CLI to generate a conventional commit message.
3. Displays the message. Prompts: `y` accept, `n` cancel, `e` edit manually.
4. Commits and pushes. Sets upstream automatically on first push.

### `rak pr`

AI-generated pull request via Claude + GitHub CLI.

**Flow:**
1. Guards: must be on a feature branch, no existing PR.
2. Pushes branch to origin if not already pushed.
3. Gathers all commits and diff since divergence from default branch.
4. Pipes to Claude CLI to generate a PR title and body.
5. Displays the proposal. Prompts: `y` create, `n` cancel, `e` edit title.
6. Creates the PR via `gh pr create`.

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
  commit.mjs         rak commit
  pr.mjs             rak pr
package.json
```
