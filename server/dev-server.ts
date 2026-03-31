import express from "express";
import { createServer as createViteServer } from "vite";
import app from "./app";

const PORT = 3000;

async function main() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else {
    app.use(express.static("dist"));
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
