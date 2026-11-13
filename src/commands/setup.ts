import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pc from "picocolors";
import { DokployClient, projectServices } from "../api.js";
import {
  readGlobalConfig,
  saveGlobalConfig,
  saveProjectSettings,
  loadProjectSettings,
  type GlobalConfig,
  type Host,
  type ProjectSettings,
} from "../config.js";

type HostOpts = { baseUrl?: string; apiKey?: string };
type Service = { name: string; label: string; ids: { composeId?: string; applicationId?: string } };

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

async function listServices(host: Host): Promise<Service[]> {
  try {
    const projects = await new DokployClient(host).projects();
    return projects.flatMap((p) => {
      const { compose, applications } = projectServices(p);
      return [
        ...compose.map((c) => ({ name: c.name, label: `${p.name} / ${c.name}`, ids: { composeId: c.composeId } })),
        ...applications.map((a) => ({
          name: a.name,
          label: `${p.name} / ${a.name}`,
          ids: { applicationId: a.applicationId },
        })),
      ];
    });
  } catch (e) {
    console.log(pc.yellow(`could not list services: ${(e as Error).message}`));
    return [];
  }
}

// numbered list of every compose and app on the host. a pasted id still works
async function pickService(host: Host, current: ProjectSettings): Promise<Service> {
  const services = await listServices(host);
  const numWidth = String(services.length).length;
  const width = Math.max(0, ...services.map((s) => s.label.length));
  services.forEach((s, i) => {
    const id = s.ids.composeId ? `compose ${s.ids.composeId}` : `app ${s.ids.applicationId}`;
    console.log(`  ${String(i + 1).padStart(numWidth)}) ${s.label.padEnd(width)}  ${pc.dim(id)}`);
  });

  const fallback = current.composeId ?? current.applicationId ?? "";
  while (true) {
    const answer = await prompt(services.length ? "service (number or id)" : "compose id", fallback);
    if (!answer) throw new Error("compose id is required");

    if (services.length && /^\d+$/.test(answer)) {
      const picked = services[Number(answer) - 1];
      if (picked) return picked;
      console.log(pc.red(`pick 1-${services.length} or paste an id`));
      continue;
    }

    const known = services.find((s) => s.ids.composeId === answer || s.ids.applicationId === answer);
    if (known) return known;
    if (answer === current.applicationId) return { name: "", label: answer, ids: { applicationId: answer } };
    return { name: "", label: answer, ids: { composeId: answer } };
  }
}

// dokploy init -> picks a host and a service, writes .dokploy.json in the current directory
export async function initCommand(opts: { composeId?: string; name?: string }) {
  const existing = loadProjectSettings() ?? {};
  const host = await pickHost(existing.host);

  const service: Service = opts.composeId
    ? { name: "", label: opts.composeId, ids: { composeId: opts.composeId } }
    : await pickService(readGlobalConfig().hosts[host], existing);
  const name = opts.name ?? (await prompt("name (optional)", service.name || existing.name || ""));

  // clear both ids first so switching between compose and app leaves no stale id
  const path = saveProjectSettings({
    ...existing,
    host,
    composeId: undefined,
    applicationId: undefined,
    ...service.ids,
    name: name || undefined,
  });
  console.log(`${pc.green("✓")} wrote ${path}`);
}
