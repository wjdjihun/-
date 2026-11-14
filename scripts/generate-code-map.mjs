import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const files = [".env.example", "docker-compose.yml"];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__pycache__") walk(path);
    } else if ([".py", ".ts", ".tsx"].includes(extname(entry.name)))
      files.push(path);
  }
}
for (const scope of ["backend/app", "backend/ml", "frontend/lib"]) walk(scope);
const entries = [];
for (const file of files) {
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      const match = line.match(
        /TODO\[([A-Z]+-\d{2})\]\s*(?:\[([^\]]+)\])?\s*(.*)/,
      );
      if (match)
        entries.push({
          id: match[1],
          owner: match[2] || "공통",
          description: match[3],
          file: relative(".", file).split(sep).join("/"),
          line: index + 1,
        });
    });
}
entries.sort(
  (a, b) =>
    a.id.localeCompare(b.id) || a.file.localeCompare(b.file) || a.line - b.line,
);
const escape = (s) => s.replaceAll("|", "\\|");
const rows = entries.map(
  (e) =>
    `| ${e.id} | ${escape(e.owner)} | [${e.file}](../${e.file}#L${e.line}) | ${e.line} | ${escape(e.description)} |`,
);
const document = [
  "# 코드 연동 표시 지도",
  "",
  "편집기 전체 검색에서 `TODO[` 또는 아래 작업 번호를 검색하세요. 상세 작업은 [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)를 참고합니다.",
  "",
  `현재 ${new Set(entries.map((e) => e.id)).size}개 작업 번호, ${entries.length}개 소스 위치가 표시되어 있습니다.`,
  "",
  "A: 가격·경제 데이터 / B: 뉴스 / C: 가격 모델 / D: 서비스 API·화면·배포.",
  "",
  "| 작업 번호 | 담당 | 파일 | 줄 | 필요한 작업 |",
  "|---|---|---|---|---|",
  ...rows,
  "",
  "줄 번호는 코드 수정 후 달라질 수 있습니다. `node scripts/generate-code-map.mjs`로 다시 생성합니다. 정적 패키징에서도 자동 갱신됩니다.",
  "",
].join("\n");
mkdirSync("docs", { recursive: true });
writeFileSync("docs/CODE_MAP.md", document);
console.log(`연동 표시 지도 생성: ${entries.length}개 위치`);
