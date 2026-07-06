#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { statusCommand } from "./commands/status.js";
import { watchCommand } from "./commands/watch.js";
import { logsCommand } from "./commands/logs.js";
import { projectsCommand } from "./commands/projects.js";
import { loginCommand, initCommand } from "./commands/setup.js";

const program = new Command();

program
  .name("dokploy")
  .description("unofficial cli for dokploy: deployment status, poll, logs")
  .version("0.1.0");

program
  .command("login")
  .description("store api key and base url in ~/.dokploy-cli/config.json")
  .option("--base-url <url>", "dokploy base url")
  .option("--api-key <key>", "api key")
  .action(run(loginCommand));

program
  .command("init")
  .description("create a .dokploysettings file in the current directory")
  .option("--compose-id <id>", "compose id for this project")
  .option("--name <name>", "friendly name")
  .action(run(initCommand));

program
  .command("status")
  .description("list recent deployments for a project (arg: name/id, or .dokploysettings)")
  .argument("[target]", "project/service name or compose id")
  .option("-l, --limit <n>", "max rows", "10")
  .action(run(statusCommand));

program
  .command("watch")
  .alias("poll")
  .description("poll the latest deployment until it finishes (spinner -> check)")
  .argument("[target]", "project/service name or compose id")
  .action(run(watchCommand));

program
  .command("logs")
  .alias("info")
  .description("show detail (status, timing, error, log path) for the latest deployment")
  .argument("[target]", "project/service name or compose id")
  .option("-e, --errors", "show only failed deployments")
  .action(run(logsCommand));

program
  .command("projects")
  .alias("ls")
  .description("list all projects and services with their ids and status")
  .action(run(projectsCommand));

program.parseAsync().catch((e) => {
  console.error(pc.red("error: ") + (e as Error).message);
  process.exit(1);
});

// wrap an async action so thrown errors print cleanly instead of an unhandled rejection
function run<A extends unknown[]>(fn: (...args: A) => Promise<void>) {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (e) {
      console.error(pc.red("error: ") + (e as Error).message);
      process.exit(1);
    }
  };
}
