# rak-tools

Personal CLI toolbox. Subcommand-based: `rak <command>`.

## Prerequisites

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm i -g @anthropic-ai/claude-code`)

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
package.json
```
