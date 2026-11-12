import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    files: [
      "apps/annotator/server/**/*.ts",
      "apps/annotator/test/**/*.ts",
      "packages/shared/**/*.ts",
      "tools/**/*.ts",
    ],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        URL: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
        structuredClone: "readonly",
      },
    },
  },
  {
    files: ["apps/annotator/web/**/*.{ts,tsx,js}"],
    languageOptions: {
      globals: {
        Blob: "readonly",
        URL: "readonly",
        caches: "readonly",
        clearTimeout: "readonly",
        document: "readonly",
        fetch: "readonly",
        indexedDB: "readonly",
        navigator: "readonly",
        self: "readonly",
        setTimeout: "readonly",
        structuredClone: "readonly",
        window: "readonly",
      },
    },
  },
];
