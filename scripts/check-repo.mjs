import { spawnSync } from "node:child_process";

// Check the index, including files added with `git add -f`.
const result = spawnSync("git", ["ls-files", "--cached", "-z"], {
  encoding: "utf8",
});
if (result.error || result.status !== 0) {
  console.error(
    result.error?.message || result.stderr || "git ls-files failed",
  );
  process.exit(1);
}

const privateDirectory =
  /^(public\/private|local|out|build|dist|\.venv)(\/|$)/i;
const audioFile = /\.(flac|mp3|wav|m4a|aac|ogg|opus|aif|aiff|wma)$/i;
const environmentFile = /(^|\/)\.env(?:\..+)?$/i;
const files = result.stdout.split("\0").filter(Boolean);
const forbidden = files.filter((file) => {
  const example = file === ".env.example" || file.endsWith("/.env.example");
  return (
    privateDirectory.test(file) ||
    audioFile.test(file) ||
    (environmentFile.test(file) && !example)
  );
});

if (forbidden.length > 0) {
  console.error("受保护文件已进入 Git 索引，请在提交前检查：");
  for (const file of forbidden) console.error(`  ${file}`);
  process.exit(1);
}
console.log("Git 索引检查通过：未发现受保护目录、常见音频或环境文件。");
console.log("仅检查路径；不识别文件内容，不检查提交历史或远端。");
