import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
execFileSync(process.execPath, ["scripts/generate-code-map.mjs"], {
  stdio: "inherit",
});
rmSync("dist", { recursive: true, force: true });
cpSync("frontend/out", "dist", { recursive: true });
mkdirSync("dist/downloads", { recursive: true });
// Include the exact clean source tree, never credentials, SQLite records or model artifacts.
execFileSync(
  "python",
  [
    "-c",
    String.raw`
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path.cwd()
skip={'.git','.venv','node_modules','.next','out','dist','__pycache__','.pytest_cache','.ruff_cache','artifacts'}
with ZipFile(root/'dist/downloads/price-radar-ai-source.zip','w',ZIP_DEFLATED) as archive:
 for path in sorted(root.rglob('*')):
  rel=path.relative_to(root)
  if any(p in skip for p in rel.parts) or not path.is_file(): continue
  if path.name=='.env' or path.name.startswith('.env.') and path.name!='.env.example': continue
  if path.suffix in {'.sqlite3','.pyc','.tsbuildinfo'}: continue
  archive.write(path,Path('price-radar-ai')/rel)
`,
  ],
  { stdio: "inherit" },
);
cpSync("README.md", "dist/downloads/README.md");
cpSync(
  "dist/downloads/price-radar-ai-source.zip",
  "dist/downloads/price-radar-ai-annotated-source.zip",
);
cpSync("START_HERE.md", "dist/downloads/START_HERE.md");
cpSync("docs/INTEGRATION_GUIDE.md", "dist/downloads/INTEGRATION_GUIDE.md");
cpSync("docs/CODE_MAP.md", "dist/downloads/CODE_MAP.md");
cpSync(
  "docs/product_mapping.template.csv",
  "dist/downloads/product_mapping.template.csv",
);
console.log(`정적 배포 파일과 프로젝트 소스 준비 완료: ${resolve("dist")}`);
