import pc from "picocolors";
import { DokployClient } from "../api.js";
import { loadGlobalConfig } from "../config.js";
import { resolveTarget, deploymentsFor } from "../resolve.js";
import { table, deploymentRow, DEPLOYMENT_HEADERS } from "../ui.js";

export async function statusCommand(target: string | undefined, opts: { limit: string }) {
  const client = new DokployClient(loadGlobalConfig());
  const resolved = await resolveTarget(client, target);
  const deployments = await deploymentsFor(client, resolved);

  if (deployments.length === 0) {
    console.log(pc.dim("no deployments found"));
    return;
  }

  const limit = Number(opts.limit) || 10;
  const rows = deployments.slice(0, limit).map((d, i) => deploymentRow(d, i));
  console.log(table(rows, DEPLOYMENT_HEADERS));

  const latest = deployments[0];
  if (latest.status === "error" && latest.errorMessage) {
    console.log("\n" + pc.red("latest error: ") + latest.errorMessage);
    console.log(pc.dim(`run "dokploy logs" for full log`));
  }
}
