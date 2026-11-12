import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    files: ["scripts/**/*.mjs"],
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
    files: ["scripts/annotator/**/*.js"],
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
