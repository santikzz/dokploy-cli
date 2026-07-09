import { spawnSync } from "node:child_process";
import { basename } from "node:path";

// gui editors that return immediately; map to the flag that makes them block
const WAIT_FLAG: Record<string, string> = {
  code: "--wait",
  "code-insiders": "--wait",
  codium: "--wait",
  vscodium: "--wait",
  cursor: "--wait",
  windsurf: "--wait",
  subl: "-w",
  sublime_text: "-w",
};

// open a file in a blocking editor and return once it closes.
// resolution: `preferred` (flag/settings), then $DOKPLOY_EDITOR/$VISUAL/$EDITOR,
// then vscode (code --wait), nano, vim, then a platform default (notepad / vi).
export function editFile(path: string, preferred?: string): void {
  const { cmd, args } = resolveEditor(preferred);
  const res = spawnSync(cmd, [...args, path], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.error) throw new Error(`failed to launch editor "${cmd}": ${res.error.message}`);
  if (typeof res.status === "number" && res.status !== 0)
    throw new Error(`editor "${cmd}" exited with code ${res.status}`);
}

function resolveEditor(preferred?: string): { cmd: string; args: string[] } {
  const chosen =
    preferred || process.env.DOKPLOY_EDITOR || process.env.VISUAL || process.env.EDITOR;
  if (chosen) return parseEditor(chosen);
  if (hasCommand("code")) return withWait("code", []);
  if (hasCommand("nano")) return { cmd: "nano", args: [] };
  if (hasCommand("vim")) return { cmd: "vim", args: [] };
  if (process.platform === "win32") return { cmd: "notepad", args: [] };
  return { cmd: "vi", args: [] };
}

function parseEditor(str: string): { cmd: string; args: string[] } {
  const parts = str.trim().split(/\s+/);
  return withWait(parts[0], parts.slice(1));
}

// append the wait flag for known gui editors unless the user already passed one
function withWait(cmd: string, args: string[]): { cmd: string; args: string[] } {
  const key = basename(cmd).toLowerCase().replace(/\.(cmd|exe|bat)$/, "");
  const flag = WAIT_FLAG[key];
  if (flag && !args.includes("--wait") && !args.includes("-w")) {
    return { cmd, args: [...args, flag] };
  }
  return { cmd, args };
}

function hasCommand(cmd: string): boolean {
  const probe =
    process.platform === "win32"
      ? spawnSync("where", [cmd], { stdio: "ignore" })
      : spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
  return probe.status === 0;
}
