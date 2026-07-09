import pc from "picocolors";
import { DokployClient, type LifecycleAction } from "../api.js";
import { loadGlobalConfig } from "../config.js";
import { resolveTarget, type Target } from "../resolve.js";

type Command = "deploy" | "redeploy" | "stop" | "restart";

const LABELS: Record<Command, string> = {
  deploy: "deploying",
  redeploy: "redeploying",
  stop: "stopping",
  restart: "restarting",
};

// deploy/redeploy trigger a build; watch to follow it. stop/restart are immediate.
export function lifecycleCommand(command: Command) {
  return async (target: string | undefined) => {
    const client = new DokployClient(loadGlobalConfig());
    const resolved = await resolveTarget(client, target);
    const name = "composeId" in resolved ? resolved.composeId : resolved.applicationId;

    console.log(pc.dim(`${LABELS[command]} ${name}...`));

    if (command === "restart") {
      await act(client, resolved, "stop");
      await act(client, resolved, "start");
    } else {
      await act(client, resolved, command);
    }

    console.log(pc.green(`✓ ${command} triggered`));
    if (command === "deploy" || command === "redeploy") {
      console.log(pc.dim(`run "dokploy watch" to follow the build`));
    }
  };
}

function act(client: DokployClient, target: Target, action: LifecycleAction) {
  return "composeId" in target
    ? client.composeAction(action, target.composeId)
    : client.applicationAction(action, target.applicationId);
}
