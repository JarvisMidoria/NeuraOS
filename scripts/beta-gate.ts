import { spawnSync } from "node:child_process";

type Step = {
  name: string;
  command: string;
  args: string[];
  required: boolean;
};

const argv = new Set(process.argv.slice(2));
const quickMode = argv.has("--quick");

const steps: Step[] = [
  { name: "Lint", command: "npm", args: ["run", "lint"], required: true },
  { name: "Tests", command: "npm", args: ["run", "test"], required: true },
  { name: "Build", command: "npm", args: ["run", "build"], required: !quickMode },
];

function runStep(step: Step) {
  if (!step.required) {
    console.log(`- Skip ${step.name} (quick mode)`);
    return true;
  }
  console.log(`\n==> ${step.name}`);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\n[FAIL] ${step.name} failed with exit code ${result.status ?? "unknown"}.`);
    return false;
  }
  console.log(`[OK] ${step.name}`);
  return true;
}

function reportEnvironment() {
  const required = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "AUTH_TRUST_HOST"];
  const recommended = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_STARTER",
    "STRIPE_PRICE_GROWTH",
    "STRIPE_PRICE_ENTERPRISE",
    "SHARED_LLM_API_KEY",
    "LLM_CONFIG_SECRET",
  ];

  const missingRequired = required.filter((key) => !process.env[key]);
  const missingRecommended = recommended.filter((key) => !process.env[key]);

  console.log("\n==> Environment check");
  if (missingRequired.length) {
    console.error(`[FAIL] Missing required env vars: ${missingRequired.join(", ")}`);
    return false;
  }
  console.log("[OK] Required env vars are set.");

  if (missingRecommended.length) {
    console.warn(`[WARN] Missing recommended env vars: ${missingRecommended.join(", ")}`);
  } else {
    console.log("[OK] Recommended env vars are set.");
  }
  return true;
}

function printManualChecklist() {
  console.log("\n==> Manual pilot checklist");
  console.log("Use docs/beta-gate.md before any production release:");
  console.log("- Login + role access");
  console.log("- Import center (CSV + image)");
  console.log("- Quote -> order conversion + stock impact");
  console.log("- Purchase order + receipt + stock impact");
  console.log("- AI copilot (web + messaging connectors)");
  console.log("- Billing webhook state transitions");
}

function main() {
  console.log(`NeuraOS Beta Gate (${quickMode ? "quick" : "full"})`);
  for (const step of steps) {
    const ok = runStep(step);
    if (!ok) process.exit(1);
  }

  const envOk = reportEnvironment();
  printManualChecklist();

  if (!envOk) process.exit(1);
  console.log("\n[PASS] Beta gate is green.");
}

main();
