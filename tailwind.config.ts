import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ELEVATE U brand palette (from logo + mockups)
        navy: {
          DEFAULT: "#0E2A5E",
          50: "#eef2fb",
          100: "#d6e0f3",
          600: "#163b7a",
          700: "#0E2A5E",
          800: "#0a2049",
          900: "#071736",
        },
        brand: {
          DEFAULT: "#1E50A2",
          light: "#3a73c9",
        },
        leaf: {
          DEFAULT: "#2FA84F",
          50: "#eafaf0",
          600: "#279144",
          700: "#1f7637",
        },
        gold: {
          DEFAULT: "#E0A92E",
          600: "#c8941f",
        },
        teal: {
          DEFAULT: "#14A1A8",
        },
        ink: "#0f172a",
        muted: "#64748b",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(15 42 94 / 0.08), 0 1px 2px -1px rgb(15 42 94 / 0.06)",
        cardhover: "0 8px 24px -6px rgb(15 42 94 / 0.18)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
