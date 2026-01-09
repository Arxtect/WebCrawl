import type { Config } from "tailwindcss/types/config";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f1a16",
        muted: "#6f6256",
        sand: {
          50: "#fdfaf5",
          100: "#f6f0e5",
          200: "#e9dcc7",
          300: "#dbc9ad",
        },
        accent: "#d45a2d",
        teal: "#1f7a7a",
      },
      boxShadow: {
        card: "0 18px 40px rgba(33, 24, 17, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
