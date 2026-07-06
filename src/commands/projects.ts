import pc from "picocolors";
import { DokployClient, projectServices } from "../api.js";
import { loadGlobalConfig } from "../config.js";
import { statusBadge } from "../ui.js";

// lists all projects with their compose/application services and ids,
// so you can find the id to drop into a .dokploysettings file.
export async function projectsCommand() {
  const client = new DokployClient(loadGlobalConfig());
  const projects = await client.projects();

  if (projects.length === 0) {
    console.log(pc.dim("no projects"));
    return;
  }

  for (const p of projects) {
    const { compose, applications } = projectServices(p);
    console.log(pc.bold(pc.cyan(p.name)) + pc.dim(`  ${p.projectId}`));
    for (const c of compose) {
      console.log(`  ${statusBadge(c.composeStatus)}  ${c.name}  ${pc.dim("compose " + c.composeId)}`);
    }
    for (const a of applications) {
      console.log(`  ${statusBadge(a.applicationStatus)}  ${a.name}  ${pc.dim("app " + a.applicationId)}`);
    }
    if (compose.length === 0 && applications.length === 0) console.log(pc.dim("  (no services)"));
    console.log();
  }
}
