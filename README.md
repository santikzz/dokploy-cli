# dokploy-cli

Unofficial CLI for [Dokploy](https://dokploy.com). Check deployment status, poll the
latest deployment until it finishes (spinner → check), and inspect deployment errors.

The official CLI is limited; this wraps the REST API (`x-api-key`) for the things I
actually use.

## Install

```bash
npm install
npm run build
npm link          # puts `dokploy` on your PATH globally
```

## Configure

Credentials are global, in `~/.dokploy-cli/config.json`:

```bash
dokploy login --base-url https://your-dokploy-url --api-key <YOUR_KEY>
# or run `dokploy login` for interactive prompts
```

Set a default editor for `env -e` (falls back to vscode, then nano):

```bash
dokploy login --editor vim   # or code, cursor, nano, "code --wait", etc.
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

Find ids with `dokploy projects`. Env vars `DOKPLOY_BASE_URL` / `DOKPLOY_API_KEY`
override the config file.

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
use the `.dokploysettings` in the current directory.

```bash
# from inside a repo with .dokploysettings
dokploy status
dokploy watch

# from anywhere, by name
dokploy status my-app
dokploy watch "My App"
```

## Notes / limits

- Dokploy's public API does **not** expose deployment log *content*
  (`deployment.readLogs` 404s over REST). `logs` shows what the API does return:
  status, `errorMessage`, and the server-side `logPath`. View full logs in the
  dashboard or on the server.
- `watch` polls every 3s. If the latest deployment is already finished it reports the
  result immediately and notes nothing is running.
- Status values: `running`, `done`, `error`, `idle`.
- `deploy`/`redeploy` only trigger the build — follow it with `dokploy watch`.
- `restart` is stop + start (Dokploy has no single restart endpoint); no rebuild.
- `env -e` opens an ephemeral `.env` temp file. **Save and close the tab** to apply;
  the temp file is deleted afterwards. On close the content is validated (KEY=VALUE
  format, valid keys, balanced quotes) — if it's invalid the errors are printed with
  line numbers and you're prompted to re-edit; nothing is saved until it's valid.
  Applications keep their build args/secrets; compose env is saved via `compose.update`.
- Editor resolution: `--editor` flag → project `.dokploy.json` `editor` → global
  `config.json` `editor` (set via `dokploy login --editor`) → `$DOKPLOY_EDITOR` /
  `$VISUAL` / `$EDITOR` → vscode (`code --wait`) → `nano` → `vim` → notepad (win) / `vi`.
  Any custom command works (`cursor`, `subl`, `"code --wait"`, …); known GUI editors
  get their wait flag added automatically.