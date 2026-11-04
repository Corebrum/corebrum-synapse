/**
 * Cleanup for the pre-rename AgenticROS MCP id.
 *
 * `synapse mcp setup` used to leave `agenticros` beside `synapse` after the
 * rename. Agents then saw duplicate ROS tool namespaces. These helpers strip
 * the old server, allow rules, embodiment block, Cursor rule, Antigravity
 * skill, and OpenClaw plugin entry when Synapse is configured.
 */

import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const LEGACY_MCP_SERVER_KEY = "agenticros";
export const LEGACY_EMBODIMENT_BEGIN = "<!-- agenticros-embodiment -->";
export const LEGACY_EMBODIMENT_END = "<!-- /agenticros-embodiment -->";
export const LEGACY_CLAUDE_ALLOW_RULE = "mcp__agenticros__*";
export const LEGACY_AGY_ALLOW_RULE = "mcp(agenticros/*)";

const LEGACY_CODEX_BLOCK = "[mcp_servers.agenticros]";
const LEGACY_CODEX_ENV_BLOCK = "[mcp_servers.agenticros.env]";
const LEGACY_HERMES_KEY = "agenticros:";

/** Drop `mcpServers.agenticros` from an in-memory server map. */
export function stripLegacyMcpServer(servers: Record<string, unknown>): void {
  delete servers[LEGACY_MCP_SERVER_KEY];
}

/** Drop AgenticROS allow rules while keeping every other entry. */
export function stripLegacyAllowRules(allow: unknown[]): unknown[] {
  return allow.filter(
    (rule) => rule !== LEGACY_CLAUDE_ALLOW_RULE && rule !== LEGACY_AGY_ALLOW_RULE,
  );
}

/** Remove a leftover AgenticROS embodiment sentinel block. */
export function stripLegacyEmbodiment(text: string): string {
  const begin = text.indexOf(LEGACY_EMBODIMENT_BEGIN);
  const end = text.indexOf(LEGACY_EMBODIMENT_END);
  if (begin < 0 || end <= begin) return text;
  const head = text.slice(0, begin).replace(/\s*$/, "");
  const tail = text.slice(end + LEGACY_EMBODIMENT_END.length).replace(/^\s*/, "");
  const parts = [head, tail].filter((part) => part.length > 0);
  return parts.length === 0 ? "" : `${parts.join("\n\n")}\n`;
}

/** Remove `[mcp_servers.agenticros]` (and its `.env` child) from Codex/Grok TOML. */
export function stripLegacyCodexMcpBlock(content: string): string {
  if (!content.includes(LEGACY_CODEX_BLOCK) && !content.includes(LEGACY_CODEX_ENV_BLOCK)) {
    return content;
  }

  const lines = content.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = (lines[i] ?? "").trim();
    if (trimmed === LEGACY_CODEX_BLOCK || trimmed === LEGACY_CODEX_ENV_BLOCK) {
      i++;
      while (i < lines.length) {
        const next = (lines[i] ?? "").trim();
        // Leave the next TOML table for the outer loop (may be another legacy block).
        if (/^\[/.test(next)) break;
        i++;
      }
      continue;
    }
    out.push(lines[i] ?? "");
    i++;
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

/** Remove `agenticros:` under Hermes `mcp_servers:`. */
export function stripLegacyHermesMcpBlock(content: string): string {
  if (!content.includes(`  ${LEGACY_HERMES_KEY}`) && !content.includes(`\n${LEGACY_HERMES_KEY}`)) {
    return content;
  }

  const lines = content.split("\n");
  const mcpIdx = lines.findIndex((l) => l.trim() === "mcp_servers:");
  if (mcpIdx < 0) return content;

  let agentIdx = -1;
  for (let i = mcpIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() ?? "";
    if (/^\S/.test(lines[i] ?? "") && trimmed !== "mcp_servers:") break;
    if (trimmed === LEGACY_HERMES_KEY) {
      agentIdx = i;
      break;
    }
  }
  if (agentIdx < 0) return content;

  let endIdx = lines.length;
  for (let i = agentIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^  \S/.test(line) && !line.startsWith("    ")) {
      endIdx = i;
      break;
    }
    if (/^\S/.test(line)) {
      endIdx = i;
      break;
    }
  }

  const out = [...lines.slice(0, agentIdx), ...lines.slice(endIdx)];
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function legacyCursorRulePath(): string {
  return join(homedir(), ".cursor", "rules", "agenticros.mdc");
}

export function legacyAgySkillDir(): string {
  return join(homedir(), ".gemini", "antigravity-cli", "skills", "agenticros");
}

/** Delete the always-on Cursor rule left by AgenticROS setup. */
export function removeLegacyCursorRule(path = legacyCursorRulePath()): boolean {
  if (!existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
}

/** Delete the Antigravity skill directory left by AgenticROS setup. */
export function removeLegacyAgySkill(dir = legacyAgySkillDir()): boolean {
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Disable and unregister the OpenClaw `agenticros` plugin entry/install.
 * Returns true when the config object was changed.
 */
export function stripLegacyOpenclawPlugin(cfg: Record<string, unknown>): boolean {
  const plugins = asRecord(cfg["plugins"]);
  if (!plugins) return false;

  let changed = false;
  const entries = asRecord(plugins["entries"]);
  if (entries && LEGACY_MCP_SERVER_KEY in entries) {
    delete entries[LEGACY_MCP_SERVER_KEY];
    changed = true;
  }
  const installs = asRecord(plugins["installs"]);
  if (installs && LEGACY_MCP_SERVER_KEY in installs) {
    delete installs[LEGACY_MCP_SERVER_KEY];
    changed = true;
  }

  const allow = plugins["allow"];
  if (Array.isArray(allow)) {
    const next = allow.filter((id) => id !== LEGACY_MCP_SERVER_KEY);
    if (next.length !== allow.length) {
      plugins["allow"] = next;
      changed = true;
    }
  }

  return changed;
}
