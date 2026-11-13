import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pc from "picocolors";
import {
  readGlobalConfig,
  saveGlobalConfig,
  saveProjectSettings,
  loadProjectSettings,
  type GlobalConfig,
} from "../config.js";

type HostOpts = { baseUrl?: string; apiKey?: string };

async function prompt(question: string, fallback = ""): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const suffix = fallback ? pc.dim(` (${fallback})`) : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  rl.close();
  return answer || fallback;
}

// prompts for whatever is missing, saves the host to the global config and returns its alias
async function addHost(cfg: GlobalConfig, alias?: string, opts: HostOpts = {}): Promise<string> {
  const name = alias ?? (await prompt("alias (e.g. prod)"));
  if (!/^[\w.-]+$/.test(name)) {
    throw new Error("alias may only use letters, numbers, dots, dashes and underscores");
  }

  const existing = cfg.hosts[name];
  const baseUrl = (opts.baseUrl ?? (await prompt("base url", existing?.baseUrl ?? ""))).replace(/\/+$/, "");
  if (!/^https?:\/\/\S+$/.test(baseUrl)) throw new Error("base url must start with http:// or https://");

  const keyAnswer = opts.apiKey ?? (await prompt(existing ? "api key (enter to keep)" : "api key"));
  const apiKey = keyAnswer || existing?.apiKey || "";
  if (!apiKey) throw new Error("api key is required");

  cfg.hosts[name] = { baseUrl, apiKey };
  const path = saveGlobalConfig(cfg);
  console.log(`${pc.green("✓")} saved host "${name}" to ${path}`);
  return name;
}

// lists the saved hosts to pick from, plus an entry to add a new one
async function pickHost(current?: string): Promise<string> {
  const cfg = readGlobalConfig();
  const aliases = Object.keys(cfg.hosts);

  const flag = process.env.DOKPLOY_HOST;
  if (flag) {
    if (!cfg.hosts[flag]) throw new Error(`unknown host "${flag}". add it with "dokploy login ${flag}"`);
    return flag;
  }

  if (aliases.length === 0) {
    console.log(pc.dim("no hosts set up yet, add one"));
    return addHost(cfg);
  }

  const width = Math.max(...aliases.map((a) => a.length));
  aliases.forEach((a, i) => console.log(`  ${i + 1}) ${a.padEnd(width)}  ${pc.dim(cfg.hosts[a].baseUrl)}`));
  console.log(`  ${aliases.length + 1}) add new host`);

  while (true) {
    const answer = await prompt("host", current && cfg.hosts[current] ? current : "");
    if (cfg.hosts[answer]) return answer;

    const n = Number(answer);
    if (n === aliases.length + 1) return addHost(cfg);
    if (Number.isInteger(n) && n >= 1 && n <= aliases.length) return aliases[n - 1];
    console.log(pc.red(`pick 1-${aliases.length + 1} or a host alias`));
  }
}

// dokploy login [alias] -> adds or updates a host in ~/.dokploy-cli/config.json
export async function loginCommand(alias: string | undefined, opts: HostOpts & { editor?: string }) {
  const cfg = readGlobalConfig();
  if (opts.editor) cfg.editor = opts.editor;

  // editor-only update: skip the host prompts
  if (opts.editor && !alias && !opts.baseUrl && !opts.apiKey) {
    const path = saveGlobalConfig(cfg);
    console.log(`${pc.green("✓")} default editor set to "${opts.editor}" in ${path}`);
    return;
  }

  await addHost(cfg, alias, opts);
}

// dokploy init -> picks a host and writes .dokploy.json in the current directory
export async function initCommand(opts: { composeId?: string; name?: string }) {
  const existing = loadProjectSettings() ?? {};
  const host = await pickHost(existing.host);

  const composeId = opts.composeId ?? (await prompt("compose id", existing.composeId ?? ""));
  if (!composeId) throw new Error("compose id is required");
  const name = opts.name ?? (await prompt("name (optional)", existing.name ?? ""));

  const path = saveProjectSettings({ ...existing, host, composeId, name: name || undefined });
  console.log(`${pc.green("✓")} wrote ${path}`);
}
