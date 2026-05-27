import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1b221c",
        line: "rgba(20, 83, 45, 0.1)",
        paper: "#f7fbf6",
        action: "#178341",
        success: "#15803d",
        warn: "#b45309",
        danger: "#dc2626"
      },
      boxShadow: {
        soft: "0 10px 24px rgba(20, 83, 45, 0.05)",
        panel: "0 20px 44px rgba(20, 83, 45, 0.07)"
      }
    }
  },
  plugins: []
};

export default config;
