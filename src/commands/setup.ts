import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pc from "picocolors";
import {
  saveGlobalConfig,
  saveProjectSettings,
  loadProjectSettings,
  readGlobalConfigFile,
} from "../config.js";

async function prompt(question: string, fallback = ""): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const suffix = fallback ? pc.dim(` (${fallback})`) : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  rl.close();
  return answer || fallback;
}

// dokploy login -> writes ~/.dokploy-cli/config.json
export async function loginCommand(opts: { baseUrl?: string; apiKey?: string; editor?: string }) {
  const existing = readGlobalConfigFile();

  // editor-only update: keep credentials, skip the prompts
  if (opts.editor && !opts.baseUrl && !opts.apiKey && existing.baseUrl && existing.apiKey) {
    const path = saveGlobalConfig({ ...existing, baseUrl: existing.baseUrl, apiKey: existing.apiKey, editor: opts.editor });
    console.log(`${pc.green("✓")} default editor set to "${opts.editor}" in ${path}`);
    return;
  }

  const baseUrl = (opts.baseUrl ?? (await prompt("base url", existing.baseUrl ?? ""))).replace(/\/+$/, "");
  const apiKeyAnswer = opts.apiKey ?? (await prompt(existing.apiKey ? "api key (enter to keep)" : "api key"));
  const apiKey = apiKeyAnswer || existing.apiKey || "";
  if (!baseUrl || !apiKey) {
    throw new Error("base url and api key are required");
  }
  const editor = opts.editor ?? existing.editor;
  const path = saveGlobalConfig({ baseUrl, apiKey, ...(editor ? { editor } : {}) });
  console.log(`${pc.green("✓")} saved credentials to ${path}`);
}

// dokploy init -> writes .dokploysettings in the current directory
export async function initCommand(opts: { composeId?: string; name?: string }) {
  const existing = loadProjectSettings() ?? {};
  const composeId = opts.composeId ?? (await prompt("compose id", existing.composeId ?? ""));
  if (!composeId) throw new Error("compose id is required");
  const name = opts.name ?? (await prompt("name (optional)", existing.name ?? ""));

  const path = saveProjectSettings({ ...existing, composeId, name: name || undefined });
  console.log(`${pc.green("✓")} wrote ${path}`);
}
