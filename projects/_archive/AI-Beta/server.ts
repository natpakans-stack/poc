import demo from "./demo.html";

Bun.serve({
  port: 3333,
  routes: {
    "/": demo,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Server running at http://localhost:3333");
