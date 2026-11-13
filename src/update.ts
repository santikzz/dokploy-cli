import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";

const PKG = "@santikzz/dokploy-cli";

// package root: one level up from both src/ (tsx) and dist/ (built)
const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const VERSION: string = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

function isNewer(latest: string, current: string): boolean {
  const a = latest.split(".").map((n) => parseInt(n, 10));
  const b = current.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

async function fetchLatest(): Promise<string> {
  const res = await fetch(`https://registry.npmjs.org/${PKG}/latest`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`npm registry returned ${res.status}`);
  const { version } = (await res.json()) as { version?: string };
  if (!version) throw new Error("npm registry returned no version");
  return version;
}

// resolves to a notice when npm has a newer version. never throws, so an offline
// registry cannot break a command
export async function checkForUpdate(): Promise<string | null> {
  if (!process.stderr.isTTY) return null;

  const latest = await fetchLatest().catch(() => null);
  if (!latest || !isNewer(latest, VERSION)) return null;
  return `${pc.yellow("update available")} ${VERSION} -> ${latest}. run "dokploy update"`;
}

// dokploy update -> reinstalls the latest version with the package manager that installed it
export async function updateCommand() {
  const latest = await fetchLatest();
  if (!isNewer(latest, VERSION)) {
    console.log(`${pc.green("✓")} already on the latest version (${VERSION})`);
    return;
  }

  // npm link / source checkout: a registry install would replace the link
  if (existsSync(join(ROOT, ".git"))) {
    console.log(`${VERSION} -> ${latest} available. this is a source checkout (${ROOT}), update it with:`);
    console.log("  git pull && npm run build");
    return;
  }

  const install = ROOT.includes("pnpm") ? "pnpm add -g" : "npm install -g";
  const cmd = `${install} ${PKG}@latest`;
  console.log(pc.dim(`$ ${cmd}`));
  const res = spawnSync(cmd, { stdio: "inherit", shell: true });
  if (res.status !== 0) throw new Error(`update failed. run it manually: ${cmd}`);
  console.log(`${pc.green("✓")} updated ${VERSION} -> ${latest}`);
}
