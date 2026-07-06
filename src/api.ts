import type { GlobalConfig } from "./config.js";

export type DeploymentStatus = "running" | "done" | "error" | "idle";

export type Deployment = {
  deploymentId: string;
  title: string;
  description: string;
  status: DeploymentStatus;
  logPath: string | null;
  pid: number | null;
  applicationId: string | null;
  composeId: string | null;
  serverId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

export type Compose = {
  composeId: string;
  name: string;
  composeStatus?: DeploymentStatus;
  [k: string]: unknown;
};

export type Application = {
  applicationId: string;
  name: string;
  applicationStatus?: DeploymentStatus;
  [k: string]: unknown;
};

export type Environment = {
  environmentId: string;
  name: string;
  isDefault?: boolean;
  applications?: Application[];
  compose?: Compose[];
  [k: string]: unknown;
};

export type Project = {
  projectId: string;
  name: string;
  environments?: Environment[];
  [k: string]: unknown;
};

// services are nested under project.environments[]; flatten to a single list per project
export function projectServices(p: Project): { compose: Compose[]; applications: Application[] } {
  const compose: Compose[] = [];
  const applications: Application[] = [];
  for (const env of p.environments ?? []) {
    compose.push(...(env.compose ?? []));
    applications.push(...(env.applications ?? []));
  }
  return { compose, applications };
}

export class DokployError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DokployError";
  }
}

export class DokployClient {
  constructor(private cfg: GlobalConfig) {}

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.cfg.baseUrl}/api/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let res: Response;
    try {
      res = await fetch(url, { headers: { "x-api-key": this.cfg.apiKey } });
    } catch (e) {
      throw new DokployError(`network error reaching ${url.host}: ${(e as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const detail = body ? ` — ${body.slice(0, 200)}` : "";
      throw new DokployError(`${res.status} ${res.statusText} on ${path}${detail}`, res.status);
    }
    return (await res.json()) as T;
  }

  projects(): Promise<Project[]> {
    return this.get<Project[]>("project.all");
  }

  compose(composeId: string): Promise<Compose> {
    return this.get<Compose>("compose.one", { composeId });
  }

  application(applicationId: string): Promise<Application> {
    return this.get<Application>("application.one", { applicationId });
  }

  deploymentsByCompose(composeId: string): Promise<Deployment[]> {
    return this.get<Deployment[]>("deployment.allByCompose", { composeId });
  }

  deploymentsByApplication(applicationId: string): Promise<Deployment[]> {
    return this.get<Deployment[]>("deployment.all", { applicationId });
  }
}
