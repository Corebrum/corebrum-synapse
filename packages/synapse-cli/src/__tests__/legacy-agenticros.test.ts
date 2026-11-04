import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { upsertClaudeMcpAllowRule, upsertSynapseMcpJson, buildSynapseMcpServerEntry } from "../util/claude-config.js";
import { upsertAgyMcpAllowRule, upsertAgyMcpJson, buildAgyMcpServerEntry } from "../util/agy-config.js";
import { upsertSynapseBlock as upsertCodexBlock } from "../util/codex-config.js";
import { upsertSynapseBlock as upsertHermesBlock, buildSynapseMcpYamlBlock } from "../util/hermes-config.js";
import { upsertEmbodiment, EMBODIMENT_BEGIN } from "../util/embodiment.js";
import {
  LEGACY_AGY_ALLOW_RULE,
  LEGACY_CLAUDE_ALLOW_RULE,
  LEGACY_EMBODIMENT_BEGIN,
  LEGACY_EMBODIMENT_END,
  removeLegacyAgySkill,
  removeLegacyCursorRule,
  stripLegacyCodexMcpBlock,
  stripLegacyHermesMcpBlock,
  stripLegacyOpenclawPlugin,
} from "../util/legacy-agenticros.js";

describe("legacy-agenticros cleanup", () => {
  it("upsertSynapseMcpJson drops agenticros and keeps other servers", () => {
    const existing = JSON.stringify({
      mcpServers: {
        other: { command: "echo" },
        agenticros: { command: "old" },
        synapse: { command: "stale" },
      },
    });
    const merged = JSON.parse(
      upsertSynapseMcpJson(existing, buildSynapseMcpServerEntry("/abs/index.js")),
    ) as { mcpServers: Record<string, unknown> };
    assert.ok(merged.mcpServers.other);
    assert.ok(merged.mcpServers.synapse);
    assert.equal(merged.mcpServers.agenticros, undefined);
  });

  it("upsertAgyMcpJson drops agenticros", () => {
    const existing = JSON.stringify({
      mcpServers: {
        agenticros: { command: "old" },
        other: { command: "echo" },
      },
    });
    const merged = JSON.parse(
      upsertAgyMcpJson(existing, buildAgyMcpServerEntry("/abs/index.js")),
    ) as { mcpServers: Record<string, unknown> };
    assert.equal(merged.mcpServers.agenticros, undefined);
    assert.ok(merged.mcpServers.synapse);
    assert.ok(merged.mcpServers.other);
  });

  it("allow-rule upserts drop AgenticROS rules", () => {
    const claude = JSON.parse(
      upsertClaudeMcpAllowRule(
        JSON.stringify({
          permissions: { allow: [LEGACY_CLAUDE_ALLOW_RULE, "Bash(ls)"] },
        }),
      ),
    ) as { permissions: { allow: string[] } };
    assert.deepEqual(claude.permissions.allow, ["Bash(ls)", "mcp__synapse__*"]);

    const agy = JSON.parse(
      upsertAgyMcpAllowRule(
        JSON.stringify({
          permissions: { allow: [LEGACY_AGY_ALLOW_RULE, "command(git)"] },
        }),
      ),
    ) as { permissions: { allow: string[] } };
    assert.deepEqual(agy.permissions.allow, ["command(git)", "mcp(synapse/*)"]);
  });

  it("upsertEmbodiment removes the AgenticROS sentinel block", () => {
    const existing = `${LEGACY_EMBODIMENT_BEGIN}\nold body\n${LEGACY_EMBODIMENT_END}\n\nKeep me.\n`;
    const next = upsertEmbodiment(existing);
    assert.doesNotMatch(next, /agenticros-embodiment/);
    assert.doesNotMatch(next, /old body/);
    assert.match(next, /Keep me/);
    assert.match(next, new RegExp(EMBODIMENT_BEGIN));
  });

  it("stripLegacyCodexMcpBlock removes agenticros and its env table", () => {
    const toml = `[mcp_servers.other]
command = "echo"

[mcp_servers.agenticros]
command = "sh"
args = ["-c", "old"]

[mcp_servers.agenticros.env]
AGENTICROS_ROBOT_NAMESPACE = ""

[mcp_servers.synapse]
command = "sh"
`;
    const cleaned = stripLegacyCodexMcpBlock(toml);
    assert.doesNotMatch(cleaned, /agenticros/);
    assert.match(cleaned, /\[mcp_servers\.other\]/);
    assert.match(cleaned, /\[mcp_servers\.synapse\]/);

    const block = `[mcp_servers.synapse]
command = "sh"
args = ["-c", "node /abs/index.js"]
enabled = true

[mcp_servers.synapse.env]
SYNAPSE_ROBOT_NAMESPACE = ""
`;
    const merged = upsertCodexBlock(toml, block);
    assert.doesNotMatch(merged, /agenticros/);
    assert.match(merged, /\[mcp_servers\.synapse\]/);
  });

  it("stripLegacyHermesMcpBlock removes agenticros under mcp_servers", () => {
    const yaml = `model:
  name: local
mcp_servers:
  agenticros:
    command: "old"
    args: ["/old.js"]
  other:
    command: "echo"
`;
    const cleaned = stripLegacyHermesMcpBlock(yaml);
    assert.doesNotMatch(cleaned, /agenticros/);
    assert.match(cleaned, /other:/);

    const merged = upsertHermesBlock(yaml, buildSynapseMcpYamlBlock("/abs/index.js"));
    assert.doesNotMatch(merged, /agenticros:/);
    assert.match(merged, /synapse:/);
  });

  it("stripLegacyOpenclawPlugin removes entries and installs", () => {
    const cfg: Record<string, unknown> = {
      plugins: {
        allow: ["agenticros", "synapse"],
        entries: {
          agenticros: { enabled: true },
          synapse: { enabled: true },
        },
        installs: {
          agenticros: { sourcePath: "/old" },
          synapse: { sourcePath: "/new" },
        },
      },
    };
    assert.equal(stripLegacyOpenclawPlugin(cfg), true);
    const plugins = cfg.plugins as {
      allow: string[];
      entries: Record<string, unknown>;
      installs: Record<string, unknown>;
    };
    assert.deepEqual(plugins.allow, ["synapse"]);
    assert.equal(plugins.entries.agenticros, undefined);
    assert.ok(plugins.entries.synapse);
    assert.equal(plugins.installs.agenticros, undefined);
    assert.equal(stripLegacyOpenclawPlugin(cfg), false);
  });

  it("removeLegacyCursorRule and removeLegacyAgySkill delete leftovers", () => {
    const dir = mkdtempSync(join(tmpdir(), "synapse-legacy-"));
    const rule = join(dir, "agenticros.mdc");
    const skill = join(dir, "skills", "agenticros");
    writeFileSync(rule, "old\n");
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "old\n");
    assert.equal(removeLegacyCursorRule(rule), true);
    assert.equal(existsSync(rule), false);
    assert.equal(removeLegacyAgySkill(skill), true);
    assert.equal(existsSync(skill), false);
    assert.equal(removeLegacyCursorRule(rule), false);
    assert.equal(removeLegacyAgySkill(skill), false);
  });
});
