const fs = require("fs");
const path = process.argv[2];
const b = fs.readFileSync(path);
const s = b.toString("latin1");
const parts = s.match(/\((?:\\.|[^\\)]){4,}\)/g) || [];
const texts = parts
  .map((p) =>
    p
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\(\d{3})/g, (_, n) => String.fromCharCode(parseInt(n, 8))),
  )
  .filter((t) => /[A-Za-z]{3,}/.test(t));
fs.writeFileSync("pdf-extract.txt", texts.join("\n---\n"), "utf8");
console.log("matches", parts.length, "texts", texts.length);
console.log(texts.slice(0, 80).join("\n---\n"));
