import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    files: [
      "apps/annotator/server/**/*.mjs",
      "apps/annotator/test/**/*.mjs",
      "packages/shared/**/*.mjs",
      "tools/**/*.mjs",
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
    files: ["apps/annotator/web/**/*.js"],
    languageOptions: {
      globals: {
        clearTimeout: "readonly",
        document: "readonly",
        fetch: "readonly",
        navigator: "readonly",
        setTimeout: "readonly",
        structuredClone: "readonly",
        window: "readonly",
      },
    },
  },
];
