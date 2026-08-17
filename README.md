# rak-tools

Git workflow CLI. AI commands run on either the Claude Code CLI or a local Ollama model, chosen per command.

## Quick start

```bash
git clone https://src.shef.ac.uk/cs1rma/rak-tools.git
cd rak-tools && npm link          # installs the `rak` binary globally
rak                                # commands, current backend, project key
```

Needs Node 21+ and `gh` (authed). Any OS, except `rak aws` which is PowerShell only. Then either:

- **Claude backend:** `npm i -g @anthropic-ai/claude-code`
- **Local backend:** install [Ollama](https://ollama.com/), `ollama pull qwen2.5-coder:7b`, set the tag in `rak.config.mjs`

Uninstall: `npm unlink -g rak-tools`

## Commands

| Command | Does | AI | Cached |
| --- | --- | --- | --- |
| `rak commit` | Commit message from staged diff, then commit + push | yes | yes |
| `rak pr` | Create or update a GitHub PR with generated title/body | yes | no |
| `rak branch` | Kebab-case branch name from uncommitted changes, then checkout | yes | yes |
| `rak review` | Code review, tagged `[BUG]` `[SECURITY]` `[PERF]` `[SUGGESTION]` `[STYLE]` | yes | yes |
| `rak slim [file\|all]` | `[CUT]` findings with before/after snippets | yes | no |
| `rak rebase` | Rebase onto default branch, AI conflict resolution | yes | no |
| `rak history <file>` | Commits touching a file; enter a number for its diff | no | no |
| `rak aws [profile]` | Pick an AWS profile, SSO log in if needed, set `AWS_PROFILE` | no | no |
| `rak tf <cmd> [env]` | `terraform init` then `init\|plan\|apply\|destroy` on the stack you are in | no | no |
| `rak clean` | Delete local branches whose PR is `MERGED` | no | no |
| `rak cache` | Clear the response cache | no | no |
| `rak ai [backend] [cmd]` | Show which backend each command uses, or change it | no | no |

Every AI command shows its output and prompts `y` accept / `n` cancel / `e` edit before doing anything.

### Behaviour worth knowing

- **`branch`**: asks for the ticket before the AI call, so you are not waiting on it. Blank gives the bare name.
- **`commit`**: stages everything with `git add -A` if nothing is staged. Pushes with `-u`.
- **`pr`**: offers to commit dirty changes first. Refuses on the default branch or with nothing ahead of it. Sends `--stat` on `local`, the full diff on `claude`. Updates an existing PR rather than duplicating it.
- **`review`** and **`slim`** (no args): feature branch diffs committed + uncommitted against the default branch; default branch diffs uncommitted only. `rak slim <file>` reads one file, `rak slim all` loops every tracked code file.
- **`rebase`**: fetches first, then per-file accept or skip at each conflict stop. On the default branch it just pulls.
- **`clean`**: switches to the default branch and `pull --ff-only` first, so the branch you just merged is eligible. Stays put if the tree is dirty. Deletes with `-d`, falling back to `-D` for squash merges.
- **`aws`**: PowerShell only. Needs the AWS CLI and the shell integration below. Skips `aws sso login` while a cached token is valid. Pass a profile to skip the menu.
- **`tf`**: run it from a folder containing `tfvars/`. Environments come from `tfvars/<env>.tfvars`. Always `init -reconfigure` with `<env>.backend.tfvars` first, then your command with `-var-file`.

## Ticket prefixes

```bash
git config rak.project CDC    # per repo, since one clone serves them all
```

`rak branch` then asks for a number, taking `1234`, `CDC-1234` or `#1234`. `commit` and `pr` read it back out of the branch name, so they never ask.

| Branch | Commit subject | PR title |
| --- | --- | --- |
| `CDC-1234/add-user-auth` | `[CDC-1234] feat: add user auth` | `[CDC-1234] Add user auth` |
| `add-user-auth` (blank number) | unprefixed | `[CDC-000] Add user auth` |

Any `<key>-<number>/` prefix parses, so a teammate's `DFLOW-7/...` works too. Already-prefixed text is never doubled. `config.project` in `rak.config.mjs` is a global fallback.

## Shell integration (PowerShell)

Required for `rak aws`. Run once from your clone to append the right absolute path to `$PROFILE`:

```powershell
Add-Content $PROFILE ". `"$(Resolve-Path .\scripts\profile.ps1)`""
. $PROFILE
```

It shadows the `rak` binary with a function that runs `scripts/<command>.ps1` in your session, forwards everything else to Node, and adds `raws` as shorthand for `rak aws`. Without it, `rak aws` runs as a child process and cannot set `AWS_PROFILE` in your shell; it says so rather than pretending otherwise. No bash equivalent yet.

## Config

`rak.config.mjs` is gitignored, so your URLs, browsers and model choice stay local.
The first `rak` run copies [`rak.config.example.mjs`](rak.config.example.mjs) into
place and tells you; edit the copy. Delete it and run `rak` again to start over.

```js
export default {
  ai: "local",                                   // default backend
  commands: { review: "claude", slim: "claude" }, // per-command overrides
  browser: "msedge",                             // default browser for `rak open`
  open: { jira: { url: "https://...", browser: "chrome" } },
  local: { url: "http://localhost:11434/api/chat", model: "qwen2.5-coder:14b" },
};
```

Import it from `load-config.mjs`, never from `rak.config.mjs` directly. A static
import of a gitignored file fails at link time on a fresh clone, before anything
can create it.

Backend resolves as `RAK_AI` → `commands.<name>` → `ai` → `claude`. `rak ai` edits the file for you, keeping its comments:

```bash
rak ai                  # what each command currently uses
rak ai claude           # switch the default
rak ai local commit     # override one command
```

| Env var | Overrides |
| --- | --- |
| `RAK_AI` | Backend for every command (`claude` or `local`) |
| `RAK_AI_MODEL` | `local.model` |
| `RAK_AI_URL` | `local.url` |

```bash
RAK_AI=claude rak commit    # one-off
```

## Local LLM setup

1. Install [Ollama](https://ollama.com/). The Windows installer adds it to `PATH` and runs it as a service.
2. `ollama pull qwen2.5-coder:7b`. Models land in `C:\Users\<username>\.ollama\models`; `OLLAMA_MODELS` relocates them.
3. Set `local.model` to the exact tag from `ollama list`.
4. Check it is up: `curl http://localhost:11434/api/tags`. If not, `ollama serve`.

`7b` keeps a decent pace on a laptop; `14b` is better but wants more RAM/VRAM. The first request after startup is slow while the model loads. Connection refused means Ollama is down or the tag does not exist locally.

## Prompts

`prompts/<command>-claude.txt` and `prompts/<command>-local.txt`. Two variants because small models need tighter instructions. Edit to change behaviour, no code change needed.

## Caching

`commit`, `branch`, and `review` key results on a hash of their input diff, so re-running with no code changes costs nothing. One entry per command, in `%TEMP%/rak-cache/diff-cache.json`. Clear with `rak cache`.

## Default branch detection

Tried in order: `gh repo view --json defaultBranchRef`, `git symbolic-ref refs/remotes/origin/HEAD`, then `main`. Used by `pr`, `review`, `slim`, `rebase`, `clean`. If step 2 fails, run `git remote set-head origin -a`.

## Adding commands

Filename becomes the subcommand. No registration. Extra args forwarded either way.

```
commands/example.mjs  →  rak example
scripts/example.ps1   →  rak example    (fallback when no .mjs exists)
```

```js
export default async function example() {
  const arg = process.argv[3];
}
```

`util.mjs` exports `ai`, `getPrompt`, `getBackend`, `run`, `prompt`, `c` (colours), `getDefaultBranch`, `getProject`, `getTicket`, `getPrTicket`, `withTicket`. `cache.mjs` exports `getCached`, `setCached`, `clearCache`.

For an AI command, add both prompt variants and call `ai(getPrompt("name"), input, "name")`. The third argument routes it to a backend.

## Structure

```
cli.mjs                  Entry point (rak binary)
load-config.mjs          Loads rak.config.mjs, creating it from the example
rak.config.example.mjs   Config template, tracked in git
rak.config.mjs           Your config: backends, model, browsers, open URLs (gitignored)
util.mjs                 Shared helpers
cache.mjs                Per-command result caching
commands/*.mjs           One file per subcommand
scripts/aws.ps1          rak aws (PowerShell, sets AWS_PROFILE)
scripts/profile.ps1      Shell integration, loaded from $PROFILE
prompts/*.txt            <command>-claude.txt, <command>-local.txt
```
