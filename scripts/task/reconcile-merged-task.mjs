#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`Command failed: ${cmd} ${args.join(" ")}\n${res.stderr}`);
  return res.stdout.trim();
}

function main() {
  const verifiedDir = path.join(root, "tasks/verified");
  if (!fs.existsSync(verifiedDir)) {
    console.log("No verified tasks found.");
    return;
  }

  const tasks = fs.readdirSync(verifiedDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  if (tasks.length === 0) {
    console.log("No verified tasks found.");
    return;
  }

  for (const taskId of tasks) {
    console.log(`Reconciling ${taskId} to done...`);
    const from = path.join(verifiedDir, taskId);
    const to = path.join(root, "tasks/done", taskId);
    
    // read packet
    const packetPath = path.join(from, "task.json");
    const packet = JSON.parse(fs.readFileSync(packetPath, "utf8"));
    
    const now = new Date().toISOString();
    packet.status = "done";
    packet.updatedDate = now;
    packet.stateTransitions.push({
      from: "verified",
      to: "done",
      at: now,
      actor: "github-actions",
      reason: "Automated merge reconciliation"
    });
    
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    fs.writeFileSync(path.join(to, "task.json"), JSON.stringify(packet, null, 2) + "\n", "utf8");
    
    run("git", ["add", "tasks/verified", "tasks/done"]);
    run("git", ["commit", "-m", `chore: reconcile ${taskId} to done post-merge`]);
  }
  
  run("git", ["push", "origin", "HEAD"]);
  console.log("Reconciliation complete.");
}

main();
