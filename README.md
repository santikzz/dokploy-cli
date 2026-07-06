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

Per-project resource ids live in a `.dokploysettings` file at the repo root:

```bash
dokploy init --compose-id <COMPOSE_ID> --name my-project
```

```jsonc
// .dokploysettings
{
  "composeId": "ALNN58q7AXoK78N0yG5E3",
  "name": "my-project"
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
| `dokploy init` | write `.dokploysettings` in the current directory |
| `dokploy login` | write global credentials |

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