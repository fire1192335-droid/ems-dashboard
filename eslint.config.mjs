import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  js.configs.recommended,
  ...nextVitals,
  {
    rules: {
      "import/no-anonymous-default-export": "off",
      "no-unused-vars": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**"],
  },
];

export default config;
