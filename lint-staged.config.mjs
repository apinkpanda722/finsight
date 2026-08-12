const config = {
  "*.{ts,tsx}": (filenames) => [
    `eslint --fix ${filenames.join(" ")}`,
    "tsc --noEmit",
  ],
};

export default config;
