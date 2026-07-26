import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractPath = path.join(repositoryRoot, "packages/compatibility-contracts/finalized-platform-contract.json");
const expectedBaseline = {
  path: "reference/finalized-platform",
  commit: "dbce321f61144b50a94bd11a068fa5897b0f2293",
};
const expectedPackagePaths = ["package.json", "website/astro-site/package.json"];
const expectedRouteFiles = [
  "src/app/(guest)/book/page.tsx",
  "src/app/(guest)/checkout/page.tsx",
  "src/app/(guest)/confirmation/page.tsx",
  "src/app/(guest)/lookup/page.tsx",
  "src/app/api/booking-lookup/route.ts",
  "src/app/api/checkout/hold/route.ts",
  "src/app/api/checkout/pay-at-hotel/route.ts",
  "src/app/api/health/route.ts",
  "src/app/api/notifications/process/route.ts",
  "src/app/api/resend/webhook/route.ts",
  "src/app/api/stripe/checkout-session/route.ts",
  "src/app/api/stripe/webhook/route.ts",
  "website/astro-site/src/pages/index.astro",
];

const fail = (message) => {
  process.stdout.write(`${JSON.stringify({ name: "finalized-platform-contract", passed: false, details: message })}\n`);
  process.exitCode = 1;
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sameMembers = (actual, expected) => actual.length === expected.length && actual.every((item) => expected.includes(item));

const requireExactKeys = (value, keys, label) => {
  if (!isPlainObject(value) || !sameMembers(Object.keys(value), keys)) {
    throw new Error(`${label} must contain exactly: ${keys.join(", ")}`);
  }
};

const requireStringArray = (value, label) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label} must be a non-empty array of strings`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${label} contains duplicate entries`);
  }
};

try {
  let contract;
  try {
    contract = JSON.parse(await readFile(contractPath, "utf8"));
  } catch (error) {
    throw new Error(`contract cannot be parsed: ${error.message}`);
  }

  requireExactKeys(contract, ["schemaVersion", "baseline", "packages", "routeFiles"], "contract");
  if (contract.schemaVersion !== "1.0.0") throw new Error("unsupported schemaVersion");
  requireExactKeys(contract.baseline, ["path", "commit"], "baseline");
  if (contract.baseline.path !== expectedBaseline.path || contract.baseline.commit !== expectedBaseline.commit) {
    throw new Error("baseline values do not match the declared compatibility baseline");
  }
  if (!Array.isArray(contract.packages) || contract.packages.length !== expectedPackagePaths.length) {
    throw new Error("packages must contain the declared package inventory exactly once");
  }

  const packagePaths = [];
  for (const packageContract of contract.packages) {
    requireExactKeys(packageContract, ["path", "name", "scripts"], "package contract");
    if (typeof packageContract.path !== "string" || typeof packageContract.name !== "string") {
      throw new Error("package path and name must be strings");
    }
    requireStringArray(packageContract.scripts, `scripts for ${packageContract.path}`);
    packagePaths.push(packageContract.path);
  }
  if (new Set(packagePaths).size !== packagePaths.length || !sameMembers(packagePaths, expectedPackagePaths)) {
    throw new Error("package inventory contains an unexpected or duplicate path");
  }

  requireStringArray(contract.routeFiles, "routeFiles");
  if (!sameMembers(contract.routeFiles, expectedRouteFiles)) {
    throw new Error("routeFiles contains an unexpected path or does not match the declared inventory");
  }

  const baselineRoot = path.join(repositoryRoot, contract.baseline.path);
  for (const routeFile of contract.routeFiles) {
    await access(path.join(baselineRoot, routeFile));
  }
  for (const packageContract of contract.packages) {
    const packageFile = path.join(baselineRoot, packageContract.path);
    await access(packageFile);
    let sourcePackage;
    try {
      sourcePackage = JSON.parse(await readFile(packageFile, "utf8"));
    } catch (error) {
      throw new Error(`source package ${packageContract.path} cannot be parsed: ${error.message}`);
    }
    if (sourcePackage.name !== packageContract.name) {
      throw new Error(`source package name differs for ${packageContract.path}`);
    }
    if (!isPlainObject(sourcePackage.scripts)) throw new Error(`source package scripts are missing for ${packageContract.path}`);
    const sourceScriptNames = Object.keys(sourcePackage.scripts);
    if (!sameMembers(packageContract.scripts, sourceScriptNames)) {
      throw new Error(`source package script inventory differs for ${packageContract.path}`);
    }
    for (const script of sourceScriptNames) {
      if (typeof sourcePackage.scripts[script] !== "string" || sourcePackage.scripts[script].length === 0) {
        throw new Error(`source package script is invalid: ${packageContract.path}#${script}`);
      }
    }
  }

  process.stdout.write(`${JSON.stringify({ name: "finalized-platform-contract", passed: true, details: "declared compatibility inventory is present" })}\n`);
} catch (error) {
  fail(error.message);
}
