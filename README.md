# dokploy-cli

> Unofficial command-line interface for [Dokploy](https://dokploy.com).

Deploy, watch, and inspect your Dokploy services without leaving the terminal. Trigger
builds, poll the latest deployment until it finishes (spinner -> check), read deployment
errors, and edit service env vars in your editor - all over Dokploy's REST API.

The official CLI is limited; this wraps the API (`x-api-key`) for the things you actually
do day to day.

```bash
npm install -g @santikzz/dokploy-cli
dokploy login
dokploy deploy --help
```

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

Credentials are global, stored in `~/.dokploy-cli/config.json` (mode `600`):

```bash
dokploy login --base-url https://your.dokploy.host --api-key <YOUR_KEY>
# or just run `dokploy login` for interactive prompts
```

Per-project resource ids live in a `.dokploy.json` file at the repo root
(the legacy `.dokploysettings` name is still read if present):

```bash
dokploy init --compose-id <COMPOSE_ID> --name my-project
```

```jsonc
// .dokploy.json
{
  "composeId": "ALNN58q7AXoK78N0yG5E3",
  "name": "my-project",
  "editor": "code" // optional, overrides the global default for this project
}
```

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
| `dokploy init` | write `.dokploy.json` in the current directory |
| `dokploy login` | write global credentials (`--editor` sets the default editor) |

`[target]` is optional: a project/service **name** or a raw **compose id**. Omit it to
use the `.dokploy.json` in the current directory.

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

Global credentials - `~/.dokploy-cli/config.json` (written by `dokploy login`):

| Key | Type | Required | Description |
|---|---|---|---|
| `baseUrl` | string | yes | Root URL of your Dokploy dashboard, e.g. `https://dokploy.example.com`. Trailing slashes are stripped. |
| `apiKey` | string | yes | Dokploy API key sent as the `x-api-key` header. |
| `editor` | string | no | Default editor command for `env -e`, e.g. `code`, `nano`, `vim`, `"code --wait"`. |

Per-project settings - `.dokploy.json` at the repo root (written by `dokploy init`):

| Key | Type | Required | Description |
|---|---|---|---|
| `composeId` | string | one id required | Compose service id to target. |
| `applicationId` | string | one id required | Application service id to target (alternative to `composeId`). |
| `projectId` | string | no | Project id, for disambiguation. |
| `name` | string | no | Friendly project/service name used when resolving a target. |
| `editor` | string | no | Editor for `env -e`, overrides the global `config.json` default for this project. |

## License

MIT
