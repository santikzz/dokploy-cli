# dokploy-cli

> Unofficial command-line interface for [Dokploy](https://dokploy.com).

Deploy, watch, and inspect your Dokploy services without leaving the terminal. Trigger
builds, poll the latest deployment until it finishes (spinner -> check), read deployment
errors, and edit service env vars in your editor - all over Dokploy's REST API.

The official CLI is limited; this wraps the API (`x-api-key`) for the things you actually
do day to day.

## Contents

- [dokploy-cli](#dokploy-cli)
  - [Contents](#contents)
  - [Install](#install)
  - [Get an API key](#get-an-api-key)
  - [Configure](#configure)
  - [Commands](#commands)
  - [Usage](#usage)
  - [Notes \& limits](#notes--limits)
  - [Config reference](#config-reference)
  - [License](#license)

## Install

**npm**

```bash
npm install -g @santikzz/dokploy-cli
# or pnpm install -g @santikzz/dokploy-cli
```

**Build from source (manual)**

```bash
git clone https://github.com/santikzz/dokploy-cli.git
cd dokploy-cli
npm install
npm run build
npm link          # puts `dokploy` on your PATH globally
```

Requires Node.js **>= 18**. Verify the install with `dokploy --help`.

## Get an API key

The CLI authenticates with a Dokploy API key sent as the `x-api-key` header.

1. Open your Dokploy dashboard in the browser.
2. Go to **Settings -> API/CLI** (under your user profile).
3. Click **Generate API Key**, give it a name, and copy the token - it's shown only once.
4. Your **base url** is the root of your dashboard, e.g. `https://dokploy.example.com`.

Feed both into `dokploy login` (below). Treat the key like a password - it has full API
access to your account.

## Configure

Each Dokploy instance is a **host** with an alias, stored globally in
`~/.dokploy-cli/config.json` (mode `600`). Add one host per Dokploy instance:

```bash
dokploy login prod --base-url https://dokploy.example.com --api-key <YOUR_KEY>
dokploy login staging --base-url https://dokploy.staging.dev --api-key <OTHER_KEY>
# or just run `dokploy login` for interactive prompts
```

Run `dokploy login <alias>` again to change a host's url or key.

Each repo gets a `.dokploy.json` at its root with the host alias and the service id
(the legacy `.dokploysettings` name is still read if present). `dokploy init` lists your
hosts to pick one, or adds a new host on the spot:

```bash
dokploy init
# or non-interactive
dokploy init --host prod --compose-id <COMPOSE_ID> --name my-project
```

```jsonc
// .dokploy.json
{
  "host": "prod",
  "composeId": "ALNN58q7AXoK78N0yG5E3",
  "name": "my-project",
  "editor": "code" // optional, overrides the global default for this project
}
```

Host resolution, first match wins:

1. `--host <alias>` (`-H`) flag, or the `DOKPLOY_HOST` env var
2. `host` in `.dokploy.json`
3. the only host, when just one is set up

`DOKPLOY_BASE_URL` + `DOKPLOY_API_KEY` env vars, when both are set, skip the config
entirely (handy in CI). With more than one host and no `.dokploy.json`, commands stop with
an error that lists your hosts.

You can find ids with `dokploy projects | grep -i "my-app"` or with the composeId on the dashboard project URL.

## Commands

| Command | What it does |
|---|---|
| `dokploy projects` (`ls`) | list all projects + services with ids and current status |
| `dokploy status [target]` | table of recent deployments for a project |
| `dokploy watch [target]` (`poll`) | poll the latest deployment until done/error, with a spinner |
| `dokploy logs [target]` (`info`) | detail for the latest deployment: status, timing, error, server log path |
| `dokploy logs -e [target]` | show only failed deployments |
| `dokploy deploy [target]` | build and deploy the latest source |
| `dokploy redeploy [target]` | rebuild and redeploy the current source |
| `dokploy stop [target]` | stop the running service |
| `dokploy restart [target]` | stop then start the service (no rebuild) |
| `dokploy env [target]` | print the service env |
| `dokploy env -e [target]` | edit the env in an editor; validates and saves on close |
| `dokploy env -e --editor <cmd> [target]` | edit with a one-off editor override |
| `dokploy init` | pick a host and write `.dokploy.json` in the current directory |
| `dokploy login [alias]` | add or update a host (`--editor` sets the default editor) |
| `dokploy update` | update dokploy-cli to the latest version on npm |

`[target]` is optional: a project/service **name** or a raw **compose id**. Omit it to
use the `.dokploy.json` in the current directory. Every command accepts `-H <alias>` to
pick the host.

## Usage

```bash
# from inside a repo with .dokploy.json
dokploy status
dokploy watch

# from anywhere, by name
dokploy status my-app
dokploy watch "My App"

# ship it and follow the build
dokploy deploy my-app && dokploy watch my-app
```

## Notes & limits

- Dokploy's public API does **not** expose deployment log *content*
  (`deployment.readLogs` 404s over REST). `logs` shows what the API does return:
  status, `errorMessage`, and the server-side `logPath`. View full logs in the
  dashboard or on the server.
- `watch` polls every 3s. If the latest deployment is already finished it reports the
  result immediately and notes nothing is running.
- Status values: `running`, `done`, `error`, `idle`.
- `deploy`/`redeploy` only trigger the build - follow it with `dokploy watch`.
- `restart` is stop + start (Dokploy has no single restart endpoint); no rebuild.
- Every command checks npm for a newer version and, if one exists, prints a notice to
  stderr after the command. The check is skipped when stderr is not a terminal (CI,
  pipes). `dokploy update` reinstalls with npm, or pnpm when pnpm installed it; a source
  checkout (`npm link`) gets the `git pull && npm run build` steps instead.
- `env -e` opens an ephemeral `.env` temp file. **Save and close the tab** to apply;
  the temp file is deleted afterwards. On close the content is validated (KEY=VALUE
  format, valid keys, balanced quotes) - if it's invalid the errors are printed with
  line numbers and you're prompted to re-edit; nothing is saved until it's valid.
  Applications keep their build args/secrets; compose env is saved via `compose.update`.
- Editor resolution: `--editor` flag -> project `.dokploy.json` `editor` -> global
  `config.json` `editor` (set via `dokploy login --editor`) -> `$DOKPLOY_EDITOR` /
  `$VISUAL` / `$EDITOR` -> VS Code (`code --wait`) -> `nano` -> `vim` -> notepad (win) / `vi`.
  Any custom command works (`cursor`, `subl`, `"code --wait"`, …); known GUI editors
  get their wait flag added automatically.

## Config reference

Global hosts - `~/.dokploy-cli/config.json` (written by `dokploy login` and `dokploy init`):

```json
{
  "hosts": {
    "prod": { "baseUrl": "https://dokploy.example.com", "apiKey": "..." },
    "staging": { "baseUrl": "https://dokploy.staging.dev", "apiKey": "..." }
  },
  "editor": "code"
}
```

| Key | Type | Required | Description |
|---|---|---|---|
| `hosts.<alias>.baseUrl` | string | yes | Root URL of the Dokploy dashboard. Trailing slashes are stripped. |
| `hosts.<alias>.apiKey` | string | yes | Dokploy API key sent as the `x-api-key` header. |
| `editor` | string | no | Default editor command for `env -e`, e.g. `code`, `nano`, `vim`, `"code --wait"`. |

An old single-host config (`baseUrl`/`apiKey` at the top level) is read as the host `main`
and rewritten in the new shape on the next `login`.

Per-project settings - `.dokploy.json` at the repo root (written by `dokploy init`):

| Key | Type | Required | Description |
|---|---|---|---|
| `host` | string | when 2+ hosts | Host alias from the global config. |
| `composeId` | string | one id required | Compose service id to target. |
| `applicationId` | string | one id required | Application service id to target (alternative to `composeId`). |
| `projectId` | string | no | Project id, for disambiguation. |
| `name` | string | no | Friendly project/service name used when resolving a target. |
| `editor` | string | no | Editor for `env -e`, overrides the global `config.json` default for this project. |

## License

MIT
