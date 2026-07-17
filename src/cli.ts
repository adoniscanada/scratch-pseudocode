#!/usr/bin/env node

import { parseArgs } from "node:util";

import type {
  ScratchProject,
  ScratchVariable,
  ScratchList,
  Block,
  Script,
  BlockInput,
} from "./types/index.js";

const VALUE_TRUNCATE = 50;
const LIST_TRUNCATE = 30;

const operatorCodes: Record<string, string> = {
  operator_add: "%s + %s",
  operator_subtract: "%s - %s",
  operator_multiply: "%s * %s",
  operator_divide: "%s / %s",
  operator_mod: "%s mod %s",
  operator_round: "round %s",
  operator_mathop: "%s of %s",
  operator_random: "pick random %s to %s",
  operator_lt: "%s < %s",
  operator_equals: "%s == %s",
  operator_gt: "%s > %s",
  operator_and: "%s and %s",
  operator_or: "%s or %s",
  operator_not: "not %s",
  operator_join: "join %s %s",
  operator_letter_of: "letter %s of %s",
  operator_length: "length of %s",
  operator_contains: "%s contains %s",
};

const { values, positionals } = parseArgs({
  options: {
    target: {
      type: "string",
      short: "t",
      multiple: true,
    },
  },
  allowPositionals: true,
});

const input = positionals[0];

if (!input) {
  console.error("Usage: scratch-pseudocode [-t <name>]... <url>");
  process.exit(1);
}

const match = input.trim().match(/scratch\.mit\.edu\/projects\/(\d+)/);

if (!match) {
  console.error("Usage: scratch-pseudocode [-t <name>]... <url>");
  process.exit(1);
}

const projectId = match[1];

if (!projectId) {
  console.error("Usage: scratch-pseudocode [-t <name>]... <url>");
  process.exit(1);
}

async function fetchProject(projectId: string) {
  const metaRes = await fetch(
    `https://api.scratch.mit.edu/projects/${projectId}`
  );
  const projectMeta = await metaRes.json();

  const token = projectMeta?.project_token;

  const projectRes = await fetch(
    `https://projects.scratch.mit.edu/${projectId}?token=${encodeURIComponent(
      token
    )}`
  );

  const project: ScratchProject = await projectRes.json();

  return { project, projectMeta };
}

function formatValue(value: string | number | boolean, len: number): string {
  const fmt = `\`${value.toString()}\``;
  return `${fmt.slice(0, len)}${
    fmt.length > len ? `... (${fmt.length} chars)` : ""
  }`;
}
function formatList(
  items: (string | number | boolean)[],
  cap: number,
  len: number
): string {
  const fmt = items.map((i) => {
    return formatValue(i, len);
  });

  return `[${fmt.slice(0, cap).join(", ")}${
    fmt.length > cap ? `... (${fmt.length} items)` : ""
  }]`;
}

function parseProcedure(proccode: string, args: string[]): string {
  let i = 0;
  return proccode.replace(/%[snb]/g, () => `${args[i++]}`);
}

function parseOperator(operator: string, args: string[]): string {
  return `(${parseProcedure(operatorCodes[operator] ?? operator, args)})`;
}

function collectBlocks(
  startId: string | null,
  blockMap: Record<string, Block>,
  collected: Block[]
): void {
  let currentId: string | null = startId;

  while (currentId !== null) {
    const block = blockMap[currentId];
    if (!block) break;

    const stamped = { ...block, id: currentId };
    collected.push(stamped);

    for (const key of ["SUBSTACK", "SUBSTACK2"]) {
      const bodyId = stamped.inputs[key]?.[1];

      if (typeof bodyId === "string") {
        collectBlocks(bodyId, blockMap, collected);
      }
    }

    currentId = block.next;
  }
}

function getScripts(project: ScratchProject): Record<string, Script[]> {
  const result: Record<string, Script[]> = {};

  for (const target of project.targets) {
    const scripts: Script[] = [];
    for (const [id, block] of Object.entries(target.blocks)) {
      if (block.topLevel && !block.shadow) {
        const script: Script = [];
        collectBlocks(id, target.blocks, script);
        scripts.push(script);
      }
    }
    result[target.name] = scripts;
  }

  return result;
}

function formatInput(
  input: BlockInput,
  blocks: Record<string, Block>,
  variables: Record<string, ScratchVariable>,
  lists: Record<string, ScratchList>
): string {
  if (typeof input[1] === "string") {
    const id = input[1];
    if (
      blocks[id] &&
      (blocks[id].shadow || blocks[id]?.opcode.startsWith("argument"))
    ) {
      const values = Object.values(blocks[id].fields).map(
        (field) => `${formatValue(field[0], VALUE_TRUNCATE)}`
      );
      return values.join(" ");
    }
    return toLine(blocks, input[1], variables, lists);
  }
  return input[1] ? formatValue(input[1][1], VALUE_TRUNCATE) : "";
}

function getIndents(script: Script): Map<string, number> {
  const blocks = new Map(script.map((block) => [block.id, block]));
  const memo = new Map<string, number>();

  function depth(id: string): number {
    const m = memo.get(id);
    if (m !== undefined) return m;

    const block = blocks.get(id);
    let result = 0;
    if (block && block.parent) {
      const parent = blocks.get(block.parent);
      if (parent) {
        if (parent.next === id) {
          result = Math.max(depth(block.parent), 1);
        } else {
          result = depth(block.parent) + 1;
        }
      }
    }

    memo.set(id, result);
    return result;
  }

  return new Map([...blocks.keys()].map((id) => [id, depth(id)]));
}

function toLine(
  blocks: Record<string, Block>,
  id: string,
  variables: Record<string, ScratchVariable>,
  lists: Record<string, ScratchList>
): string {
  if (!blocks[id]) return "";

  const fields = Object.entries(blocks[id].fields);
  const inputs = Object.entries(blocks[id].inputs);

  const fieldParts = fields.map(([key, [name, ref]]) => {
    if (blocks[id]?.opcode.startsWith("operator")) {
      return formatValue(name, VALUE_TRUNCATE);
    }

    if (key === "VARIABLE" && ref) {
      return `${key}=${
        variables[ref]
          ? formatValue(variables[ref][0], VALUE_TRUNCATE)
          : "undefined"
      }`;
    }
    if (key === "LIST" && ref) {
      return `${key}=${
        lists[ref] ? formatList(lists[ref][1], 10, VALUE_TRUNCATE) : "undefined"
      }`;
    }

    return `${key}=${formatValue(name, VALUE_TRUNCATE)}`;
  });

  const inputParts = inputs
    .filter(([key, _]) => {
      return !key.startsWith("SUBSTACK");
    })
    .map(([key, input]) => {
      if (
        blocks[id]?.opcode.startsWith("operator") ||
        blocks[id]?.opcode.startsWith("argument") ||
        (typeof input[1] === "string" && blocks[input[1]]?.shadow)
      ) {
        return formatInput(input, blocks, variables, lists);
      }

      return `${key}=${formatInput(input, blocks, variables, lists)}`;
    });

  const start =
    blocks[id].topLevel ||
    inputs.some(([key, _]) => key.startsWith("SUBSTACK"));

  if (blocks[id].opcode.startsWith("procedures")) {
    let args: string[];

    // Procedure call
    if (blocks[id].mutation) {
      const arr: string[] = JSON.parse(blocks[id].mutation.argumentids);
      args = arr
        .map((arg) => {
          if (blocks[id]?.inputs[arg]) {
            return formatInput(
              blocks[id].inputs[arg],
              blocks,
              variables,
              lists
            );
          }
        })
        .filter((arg) => arg !== undefined);

      return `${blocks[id].opcode}(${parseProcedure(
        blocks[id].mutation.proccode,
        args
      )})`;
    }

    // Procedure definition
    const ref = blocks[id].inputs["custom_block"];
    if (ref && typeof ref[1] === "string") {
      const proc = blocks[ref[1]];
      if (proc && proc.mutation && proc.mutation.argumentnames) {
        const args: string[] = JSON.parse(proc.mutation.argumentnames);

        return `${blocks[id].opcode}(${parseProcedure(
          proc.mutation.proccode,
          args
        )})`;
      }
    }
  }

  if (blocks[id].opcode.startsWith("operator")) {
    const args = [...fieldParts, ...inputParts];
    if (args[0]) {
      return parseOperator(blocks[id].opcode, args);
    }
  }

  return `${blocks[id].opcode}(${[...fieldParts, ...inputParts].join(", ")})${
    start ? ":" : ""
  }`;
}

function toPseudocode(project: ScratchProject, targets?: string[]): string {
  const scripts = getScripts(project);
  let pseudocode = "";

  for (const [targetName, targetScripts] of Object.entries(scripts)) {
    if (!targets || targets.includes(targetName)) {
      const target = project.targets.find((t) => t.name === targetName);
      if (target) {
        const variables = target.isStage
          ? target.variables
          : {
              ...target.variables,
              ...project.targets.find((t) => t.isStage)?.variables,
            };
        const lists = target.isStage
          ? target.lists
          : {
              ...target.lists,
              ...project.targets.find((t) => t.isStage)?.lists,
            };

        pseudocode += `\nTarget: ${formatValue(target.name, VALUE_TRUNCATE)}\n`;
        // Local variables
        if (Object.values(target.variables).length > 0) {
          pseudocode += `Variables: [${Object.values(target.variables)
            .map((v) => `${v[0]}=${formatValue(v[1], VALUE_TRUNCATE)}`)
            .join(", ")}]\n`;
        }
        // Local lists
        if (Object.values(target.lists).length > 0) {
          pseudocode += `Lists: [${Object.values(target.lists).map(
            ([name, items]) =>
              `${name}=${formatList(items, LIST_TRUNCATE, VALUE_TRUNCATE)}`
          )}]\n`;
        }
        // Costumes
        if (Object.values(target.costumes).length > 0) {
          pseudocode += `Costumes: ${formatList(
            Object.values(target.costumes).map((costume) => costume.name),
            LIST_TRUNCATE,
            VALUE_TRUNCATE
          )}\n`;
        }
        // Scripts
        if (targetScripts.length > 0) {
          for (const script of targetScripts) {
            const indents = getIndents(script);
            for (const [i, block] of script.entries()) {
              const line = toLine(target.blocks, block.id, variables, lists);
              const indent = indents.get(block.id) ?? 0;
              pseudocode += `${`\t`.repeat(indent ?? 0)}${line}\n`;
            }
          }
        }
      }
    }
  }

  return pseudocode.trim();
}

async function main(projectId: string) {
  const { project, projectMeta } = await fetchProject(projectId);

  console.log(toPseudocode(project, values.target));
}

main(projectId);
