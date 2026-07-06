import pc from "picocolors";
import { DokployClient, type Deployment } from "../api.js";
import { loadGlobalConfig } from "../config.js";
import { resolveTarget, deploymentsFor } from "../resolve.js";
import { statusBadge, fmtTime, duration } from "../ui.js";

// dokploy's public api doesn't expose deployment log content (readLogs 404s),
// but each deployment carries status, errorMessage and the server-side logPath.
// this shows that detail for the latest (or a matching) deployment.
export async function logsCommand(target: string | undefined, opts: { errors?: boolean }) {
  const client = new DokployClient(loadGlobalConfig());
  const resolved = await resolveTarget(client, target);
  const deployments = await deploymentsFor(client, resolved);

  if (deployments.length === 0) {
    console.log(pc.dim("no deployments found"));
    return;
  }

  if (opts.errors) {
    const failed = deployments.filter((d) => d.status === "error");
    if (failed.length === 0) {
      console.log(pc.green("no failed deployments"));
      return;
    }
    failed.forEach((d) => printDetail(d));
    return;
  }

  printDetail(deployments[0]);
}

function printDetail(d: Deployment) {
  console.log(`${statusBadge(d.status)}  ${pc.bold(d.title || "(untitled)")}`);
  if (d.description) console.log(pc.dim(d.description));
  console.log(`  created  ${fmtTime(d.createdAt)}`);
  console.log(`  started  ${fmtTime(d.startedAt)}`);
  console.log(`  finished ${fmtTime(d.finishedAt)}  ${pc.dim(`(${duration(d.startedAt, d.finishedAt)})`)}`);
  if (d.errorMessage) console.log("\n" + pc.red("error:") + " " + d.errorMessage);
  if (d.logPath) console.log(pc.dim(`\nlog file (on server): ${d.logPath}`));
  console.log(pc.dim(`deploymentId: ${d.deploymentId}`));
  console.log();
}
