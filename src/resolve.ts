import { loadProjectSettings } from "./config.js";
import { projectServices, type DokployClient, type Project } from "./api.js";

export type Target = { composeId: string } | { applicationId: string };

// resolve a compose/application target from an explicit arg or the project's .dokploysettings.
// an arg may be a raw id or a project/service name (resolved via project.all).
export async function resolveTarget(
  client: DokployClient,
  arg?: string,
): Promise<Target> {
  if (arg) {
    const byName = await findByName(client, arg);
    if (byName) return byName;
    // fall back to treating the arg as a raw compose id
    return { composeId: arg };
  }

  const settings = loadProjectSettings();
  if (settings?.composeId) return { composeId: settings.composeId };
  if (settings?.applicationId) return { applicationId: settings.applicationId };

  throw new Error(
    'no target. pass a name/id, or add a .dokploysettings file here ("dokploy init")',
  );
}

async function findByName(
  client: DokployClient,
  needle: string,
): Promise<Target | null> {
  let projects: Project[];
  try {
    projects = await client.projects();
  } catch {
    return null;
  }
  const lower = needle.toLowerCase();
  for (const p of projects) {
    const { compose, applications } = projectServices(p);
    const pName = p.name.toLowerCase();
    for (const c of compose) {
      if (c.name?.toLowerCase() === lower || c.composeId === needle || pName === lower) {
        return { composeId: c.composeId };
      }
    }
    for (const a of applications) {
      if (a.name?.toLowerCase() === lower || a.applicationId === needle) {
        return { applicationId: a.applicationId };
      }
    }
  }
  return null;
}

export function deploymentsFor(client: DokployClient, target: Target) {
  return "composeId" in target
    ? client.deploymentsByCompose(target.composeId)
    : client.deploymentsByApplication(target.applicationId);
}
