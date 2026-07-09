import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

// global credentials live in ~/.dokploy-cli/config.json
// per-project resource ids live in <cwd>/.dokploysettings

export type GlobalConfig = {
  baseUrl: string;
  apiKey: string;
  editor?: string;
};

export type ProjectSettings = {
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

// raw file contents without env-var overrides or validation; used when merging updates
export function readGlobalConfigFile(): Partial<GlobalConfig> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    throw new Error(`invalid json in ${CONFIG_FILE}`);
  }
}

export function loadGlobalConfig(): GlobalConfig {
  const baseUrl = process.env.DOKPLOY_BASE_URL;
  const apiKey = process.env.DOKPLOY_API_KEY;
  const file = readGlobalConfigFile();

  const resolved: GlobalConfig = {
    baseUrl: (baseUrl ?? file.baseUrl ?? "").replace(/\/+$/, ""),
    apiKey: apiKey ?? file.apiKey ?? "",
    editor: file.editor,
  };

  if (!resolved.baseUrl || !resolved.apiKey) {
    throw new Error(
      `missing credentials. run "dokploy login" or set baseUrl/apiKey in ${CONFIG_FILE}`,
    );
  }
  return resolved;
}

export function saveGlobalConfig(cfg: GlobalConfig): string {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  return CONFIG_FILE;
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
