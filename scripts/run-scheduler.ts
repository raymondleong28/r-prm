import { getAppBaseUrl } from "../src/lib/config";

async function runSchedulerCli() {
  const baseUrl = getAppBaseUrl(process.env);
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret) {
    throw new Error("FAIL_CLOSED: CRON_SECRET must be set in .env to run scheduler");
  }
  const res = await fetch(`${baseUrl}/api/scheduler`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({ action: "RUN_TICK", elapsedDays: 7 }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Scheduler run failed:", json);
    process.exit(1);
  }
  console.log("Scheduler tick succeeded:", json);
}

runSchedulerCli();
