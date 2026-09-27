import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * `.om-button` sets spacing, weight and a focus ring but no background and no
 * border — the colour comes entirely from a `om-button--*` variant. A button
 * that names the base class and no variant therefore renders as bare text with
 * padding around it, which reads as a broken control rather than a quiet one.
 *
 * Only static className strings are checked: a className built by a template
 * literal cannot be read here, and guessing at it would produce false reports.
 */
const buttonVariant = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A button styled with the base `om-button` class must also name a variant.",
    },
    schema: [],
    messages: {
      noVariant:
        'This button uses `om-button` with no `om-button--*` variant, so it has no background and a transparent border. Name one: primary, secondary, ghost, or danger.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const className = node.attributes[0];
        if (className?.type !== "JSXAttribute" || className.name.name !== "className") return;
        if (className.value?.type !== "Literal" || typeof className.value.value !== "string") {
          return;
        }
        const value = className.value.value;
        if (!/(^|\s)om-button(\s|$)/u.test(value)) return;
        if (/om-button--/u.test(value)) return;
        context.report({ node, messageId: "noVariant" });
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/out/**",
      // Staged at build time by apps/desktop/stage-mcp.cjs; the source of
      // truth is packages/mcp. A megabyte of generated bundle is not source.
      "apps/desktop/resources/**",
      "**/node_modules/**",
      // electron-builder output. Gitignored, but ESLint does not read
      // .gitignore, and a packaged build is not source.
      "**/release/**",
      "**/*.config.js",
      "**/*.cjs",
      "apps/desktop/gif.mjs",
      "docs/media/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The sample connector is a plain Node script with no dependencies, which
    // is the whole reason it is a runnable example. It is linted as source.
    files: ["examples/**/*.mjs", "examples/**/*.js"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
  {
    plugins: { om: { rules: { "button-has-variant": buttonVariant } } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "om/button-has-variant": "error",
    },
  },
);
