import pc from "picocolors";
import type { DeploymentStatus, Deployment } from "./api.js";

export function statusBadge(status?: string): string {
  switch (status) {
    case "done":
      return pc.green("● done");
    case "running":
      return pc.yellow("● running");
    case "error":
      return pc.red("● error");
    case "idle":
      return pc.dim("● idle");
    default:
      return pc.dim(`● ${status ?? "unknown"}`);
  }
}

export function isTerminal(status?: string): boolean {
  return status === "done" || status === "error";
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export function duration(start: string | null, end: string | null): string {
  if (!start) return "-";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(s) || Number.isNaN(e)) return "-";
  const secs = Math.max(0, Math.round((e - s) / 1000));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return `${m}m ${secs % 60}s`;
}

// minimal fixed-width table without deps
export function table(rows: string[][], headers: string[]): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, c) => Math.max(...all.map((r) => stripAnsi(r[c] ?? "").length)));
  const line = (r: string[]) =>
    r.map((cell, c) => pad(cell ?? "", widths[c])).join("  ");
  const out = [pc.bold(line(headers))];
  for (const r of rows) out.push(line(r));
  return out.join("\n");
}

function pad(s: string, width: number): string {
  const visible = stripAnsi(s).length;
  return s + " ".repeat(Math.max(0, width - visible));
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, "");
}

export function deploymentRow(d: Deployment, index: number): string[] {
  return [
    String(index),
    statusBadge(d.status),
    truncate(d.title || "(untitled)", 32),
    fmtTime(d.createdAt),
    duration(d.startedAt, d.finishedAt),
  ];
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export const DEPLOYMENT_HEADERS = ["#", "status", "title", "created", "took"];

export type { DeploymentStatus };
