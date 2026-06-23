// ponytail: static file server, swap to routes if it grows an API
const dir = import.meta.dir;

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(dir + path);
    if (await file.exists()) return new Response(file);
    return new Response("Not found", { status: 404 });
  },
});

console.log("http://localhost:3000  →  index.html");
console.log("http://localhost:3000/menu-chart.html");
