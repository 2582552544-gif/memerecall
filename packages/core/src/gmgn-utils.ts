import { spawn } from "node:child_process";

declare const Bun:
  | {
      spawn: (command: string[], options: { stdout: "pipe"; stderr: "pipe" }) => {
        stdout: ReadableStream;
        stderr: ReadableStream;
        exited: Promise<number>;
      };
    }
  | undefined;

export async function runBb(command: string[]): Promise<string> {
  if (typeof Bun !== "undefined") {
    const proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Command failed: ${command.join(" ")}\n${stderr || stdout}`);
    }
    return stdout.trim();
  }

  const { stdout, stderr, exitCode } = await runCommandWithNode(command);
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}\n${stderr || stdout}`);
  }
  return stdout.trim();
}

async function runCommandWithNode(
  command: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command[0], command.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

export async function runBbSafe(
  command: string[],
  fallback = "",
): Promise<string> {
  try {
    return await runBb(command);
  } catch {
    return fallback;
  }
}
