import ora from "ora";
import pc from "picocolors";
import { DokployClient, type Deployment } from "../api.js";
import { loadGlobalConfig } from "../config.js";
import { resolveTarget, deploymentsFor } from "../resolve.js";
import { isTerminal, duration, fmtTime } from "../ui.js";

const POLL_INTERVAL = 3000;
const STALE_MS = 15 * 60 * 1000; // warn if latest already finished >15m ago

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function watchCommand(target: string | undefined) {
  const client = new DokployClient(loadGlobalConfig());
  const resolved = await resolveTarget(client, target);

  const first = await latest(client, resolved);
  if (!first) {
    console.log(pc.dim("no deployments to watch"));
    return;
  }

  // already finished: report and exit, but flag if it's an old one
  if (isTerminal(first.status)) {
    const age = first.finishedAt ? Date.now() - new Date(first.finishedAt).getTime() : 0;
    report(first);
    if (age > STALE_MS) {
      console.log(pc.dim(`(latest finished ${fmtTime(first.finishedAt)} — nothing running)`));
    }
    process.exitCode = first.status === "error" ? 1 : 0;
    return;
  }

  const spinner = ora({ text: label(first), spinner: "dots" }).start();
  const watchedId = first.deploymentId;

  while (true) {
    await sleep(POLL_INTERVAL);
    let current: Deployment | null;
    try {
      current = await latest(client, resolved);
    } catch (e) {
      spinner.text = pc.dim(`poll failed, retrying… (${(e as Error).message})`);
      continue;
    }
    if (!current) continue;

    // a newer deployment superseded the one we started watching
    if (current.deploymentId !== watchedId && !isTerminal(current.status)) {
      spinner.text = label(current) + pc.dim(" (newer deployment)");
      continue;
    }

    if (isTerminal(current.status)) {
      spinner.stop();
      report(current);
      process.exitCode = current.status === "error" ? 1 : 0;
      return;
    }
    spinner.text = label(current);
  }
}

async function latest(client: DokployClient, resolved: Awaited<ReturnType<typeof resolveTarget>>) {
  const list = await deploymentsFor(client, resolved);
  return list[0] ?? null;
}

function label(d: Deployment): string {
  return `deploying ${pc.bold(d.title || "")} ${pc.dim(`(${d.status}, ${duration(d.startedAt, null)})`)}`;
}

function report(d: Deployment) {
  if (d.status === "done") {
    console.log(`${pc.green("✓")} ${d.title || "deployment"} ${pc.dim(`done in ${duration(d.startedAt, d.finishedAt)}`)}`);
    return;
  }
  console.log(`${pc.red("✗")} ${d.title || "deployment"} ${pc.red("failed")}`);
  if (d.errorMessage) console.log(`  ${d.errorMessage}`);
  if (d.logPath) console.log(pc.dim(`  log: ${d.logPath}`));
  console.log(pc.dim(`  run "dokploy logs ${d.deploymentId}" for details`));
}
