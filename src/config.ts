import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

// global hosts live in ~/.dokploy-cli/config.json
// per-project resource ids and the host alias live in <cwd>/.dokploy.json

export type Host = {
  baseUrl: string;
  apiKey: string;
};

export type GlobalConfig = {
  hosts: Record<string, Host>;
  editor?: string;
};

export type ProjectSettings = {
  host?: string;
  composeId?: string;
  applicationId?: string;
  projectId?: string;
  name?: string;
  editor?: string;
};

const CONFIG_DIR = join(homedir(), ".dokploy-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const PROJECT_FILE = ".dokploy.json";
const LEGACY_PROJECT_FILE = ".dokploysettings";
const LEGACY_HOST_ALIAS = "main";

export function readGlobalConfig(): GlobalConfig {
  if (!existsSync(CONFIG_FILE)) return { hosts: {} };
  let raw: Partial<GlobalConfig & Host> | null;
  try {
    raw = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    throw new Error(`invalid json in ${CONFIG_FILE}`);
  }
  if (!raw || typeof raw !== "object") throw new Error(`invalid config in ${CONFIG_FILE}`);

  const hosts: Record<string, Host> = raw.hosts ?? {};
  // pre-hosts configs stored a single baseUrl/apiKey at the top level
  if (!raw.hosts && raw.baseUrl && raw.apiKey) {
    hosts[LEGACY_HOST_ALIAS] = { baseUrl: raw.baseUrl, apiKey: raw.apiKey };
  }
  return { hosts, editor: raw.editor };
}

export function saveGlobalConfig(cfg: GlobalConfig): string {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  return CONFIG_FILE;
}

// host for this run: DOKPLOY_BASE_URL + DOKPLOY_API_KEY, then --host / DOKPLOY_HOST,
// then .dokploy.json "host", then the only host when just one is set up
export function loadHost(): Host {
  const envUrl = process.env.DOKPLOY_BASE_URL;
  const envKey = process.env.DOKPLOY_API_KEY;
  if (envUrl && envKey) return { baseUrl: envUrl.replace(/\/+$/, ""), apiKey: envKey };

  const { hosts } = readGlobalConfig();
  const aliases = Object.keys(hosts);
  if (aliases.length === 0) throw new Error('no hosts set up. run "dokploy login"');

  const alias =
    process.env.DOKPLOY_HOST || loadProjectSettings()?.host || (aliases.length === 1 ? aliases[0] : "");
  if (!alias) {
    throw new Error(
      `no host for this directory. run "dokploy init" or pass --host <alias>\nhosts: ${aliases.join(", ")}`,
    );
  }

  const host = hosts[alias];
  if (!host?.baseUrl || !host.apiKey) {
    throw new Error(
      `unknown host "${alias}". add it with "dokploy login ${alias}"\nhosts: ${aliases.join(", ")}`,
    );
  }
  return { baseUrl: host.baseUrl.replace(/\/+$/, ""), apiKey: host.apiKey };
}

export function loadProjectSettings(cwd = process.cwd()): ProjectSettings | null {
  for (const name of [PROJECT_FILE, LEGACY_PROJECT_FILE]) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      throw new Error(`invalid json in ${path}`);
    }
  }
  return null;
}

export function saveProjectSettings(settings: ProjectSettings, cwd = process.cwd()): string {
  const path = join(cwd, PROJECT_FILE);
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
  return path;
}
