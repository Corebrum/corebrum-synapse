import { spawn } from "node:child_process";

const ALLOWED = new Set(["compute-stats", "submit", "status", "results"]);

export async function cortexCommand(action: string, args: string[]): Promise<number> {
  if (!ALLOWED.has(action)) {
    process.stderr.write(
      "synapse cortex accepts compute-stats, submit, status, or results.\n",
    );
    return 2;
  }
  return await new Promise((resolve) => {
    const child = spawn("cortex", [action, ...args], { stdio: "inherit" });
    child.on("error", () => {
      process.stderr.write("cortex is not installed. Run: corebrum cortex install\n");
      resolve(127);
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
