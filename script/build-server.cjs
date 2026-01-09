const esbuild = require("esbuild");

const buildOptions = {
  entryPoints: ["src/server.ts"],
  bundle: true,
  outfile: "dist/server.cjs",
  platform: "node",
  format: "cjs",
  sourcemap: false,
  external: ["path", "fs", "os", "http", "https", "vite", "net", "crypto"],
  target: ["esnext"],
  loader: { ".tsx": "tsx", ".ts": "ts" },
  logLevel: "info"
};

async function build() {
  try {
    await esbuild.build(buildOptions);
    console.info("✨ Build concluído!");
  } catch (error) {
    console.error("❌ Erro no build:", error);
  }
}

build();
