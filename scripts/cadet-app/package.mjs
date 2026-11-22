import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const output = process.argv[2];
writeFileSync(
  join(output, "index.d.ts"),
  'import type { ReactElement } from "react";\nexport declare function EmbeddedApp(props: { basename?: string }): ReactElement | null;\n',
);
writeFileSync(
  join(output, "package.json"),
  JSON.stringify(
    {
      name: "@mycadet/app",
      version: "0.0.0-dev.b434b24.1",
      type: "module",
      license: "MIT",
      exports: {
        ".": { types: "./index.d.ts", default: "./index.js" },
        "./style.css": "./app.css",
      },
      peerDependencies: { react: ">=19.0.0", "react-dom": ">=19.0.0" },
      dependencies: {
        "react-i18next": "17.0.11",
        i18next: "26.3.6",
        "use-sync-external-store": "1.7.0",
      },
      sideEffects: ["*.css"],
      files: ["*.js", "*.css", "*.d.ts", "LICENSE"],
    },
    null,
    2,
  ) + "\n",
);

copyFileSync(new URL("./LICENSE", import.meta.url), join(output, "LICENSE"));
