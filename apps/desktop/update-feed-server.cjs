/* Minimal static update-feed server for local device testing (no deps). */
const http = require("node:http");
const { createReadStream, existsSync, statSync } = require("node:fs");
const { join, extname, resolve } = require("node:path");

const root = resolve(process.argv[2] || process.cwd());
const types = {
  ".yml": "text/yaml",
  ".exe": "application/octet-stream",
  ".blockmap": "application/octet-stream",
};

http
  .createServer((req, res) => {
    console.log(`[feed] ${new Date().toISOString()} ${req.method} ${req.url}`);
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel.startsWith("/")) rel = rel.slice(1);
    const file = join(root, rel === "" ? "latest.yml" : rel);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      console.log(`[feed] -> 404 ${req.url}`);
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.on("finish", () =>
      console.log(`[feed] -> 200 ${req.url} (${statSync(file).size} bytes)`),
    );
    createReadStream(file).pipe(res);
  })
  .listen(8123, () => console.log("update feed on http://localhost:8123"));