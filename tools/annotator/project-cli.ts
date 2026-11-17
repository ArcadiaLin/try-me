import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeAgentOperations, readAgentProject } from "../../apps/annotator/server/agent-operations.ts";
import { persistProjectArtifacts } from "../../apps/annotator/server/index.ts";

const args = process.argv.slice(2);
const command = args.shift();
const help = "Usage: npm run annotate:project -- read|preview|apply [--input plan.json] [--out result.json] [--root fixtureRoot]";
function option(name: string) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing value for ${name}`);
  const value = args[i + 1]; args.splice(i, 2); return value;
}
try {
  const root = path.resolve(option("--root") ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
  const input = option("--input"), output = option("--out");
  if (args.length) throw new Error(`Unknown arguments: ${args.join(" ")}`);
  if (command !== "read" && command !== "preview" && command !== "apply") throw new Error(help);
  if (command !== "read" && !input) throw new Error("--input is required; the file must include baseRevision and operations");
  const dest = output ? path.resolve(output) : undefined;
  if (dest) {
    if (!dest.startsWith(path.join(root, "local") + path.sep) && !dest.startsWith(path.join(root, "out") + path.sep)) throw new Error("--out must be inside this project's local/ or out/");
    if (dest === path.resolve(input ?? "") || fs.existsSync(dest)) throw new Error("--out must be a new file, distinct from --input");
  }
  const result = command === "read" ? readAgentProject(root)
    : executeAgentOperations(root, { ...JSON.parse(fs.readFileSync(path.resolve(input!), "utf8")), mode: command === "apply" ? "apply" : "preview" }, persistProjectArtifacts);
  const serialized = JSON.stringify(result, null, 2) + "\n";
  if (dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, serialized, { flag: "wx" });
    const summary = { ...result, project: undefined };
    console.log(JSON.stringify({ ...summary, output: dest }, null, 2));
  } else console.log(serialized);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
