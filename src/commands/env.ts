import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pc from "picocolors";
import { DokployClient, type Application, type Compose } from "../api.js";
import { loadGlobalConfig, loadProjectSettings } from "../config.js";
import { resolveTarget, type Target } from "../resolve.js";
import { editFile } from "../editor.js";
import { validateEnv, type EnvError } from "../envfile.js";

// dokploy stores env as a single multiline string. get prints it; --edit opens it
// in an editor (ephemeral temp file), validates on close, and pushes it back if valid.
export async function envCommand(target: string | undefined, opts: { edit?: boolean; editor?: string }) {
  const cfg = loadGlobalConfig();
  const client = new DokployClient(cfg);
  const resolved = await resolveTarget(client, target);
  const record = await fetchRecord(client, resolved);
  const current = normalize((record.env as string | null) ?? "");

  if (!opts.edit) {
    process.stdout.write(current ? current + "\n" : "");
    return;
  }

  const project = loadProjectSettings();
  const preferred = opts.editor ?? project?.editor ?? cfg.editor;
  const id = "composeId" in resolved ? resolved.composeId : resolved.applicationId;
  const tmp = join(tmpdir(), `dokploy-env-${id}.env`);

  writeFileSync(tmp, current);
  let edited: string;
  try {
    while (true) {
      editFile(tmp, preferred);
      edited = normalize(readFileSync(tmp, "utf8"));

      if (edited === current) {
        console.log(pc.dim("no changes, env unchanged"));
        return;
      }

      const errors = validateEnv(edited);
      if (errors.length === 0) break;

      printErrors(errors);
      if (!(await confirmReedit())) {
        console.log(pc.yellow("aborted, env not saved"));
        return;
      }
    }
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // temp file already gone, ignore
    }
  }

  await save(client, resolved, record, edited);
  console.log(pc.green("✓ env updated"));
}

function fetchRecord(client: DokployClient, target: Target): Promise<Application | Compose> {
  return "composeId" in target
    ? client.compose(target.composeId)
    : client.application(target.applicationId);
}

function save(client: DokployClient, target: Target, record: Application | Compose, env: string) {
  return "composeId" in target
    ? client.saveComposeEnv(target.composeId, env)
    : client.saveApplicationEnv(record as Application, env);
}

function printErrors(errors: EnvError[]) {
  console.error(pc.red(`✗ ${errors.length} invalid env line(s):`));
  for (const e of errors) console.error(`  ${pc.dim(`line ${e.line}`)}  ${e.message}`);
}

async function confirmReedit(): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(pc.yellow("re-edit? ") + pc.dim("(Y/n) "))).trim().toLowerCase();
  rl.close();
  return answer === "" || answer === "y" || answer === "yes";
}

// canonicalize line endings and strip trailing blank lines so a no-op edit
// (or an editor's stray final newline) is not treated as a change
function normalize(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}
