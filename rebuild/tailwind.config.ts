import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* ── Font ── */
      fontFamily: {
        sans: [
          "var(--font-manrope)",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Inter",
          "sans-serif",
        ],
      },

      /* ── Typography ── */
      fontSize: {
        xs: ["0.875rem",  { lineHeight: "1.375rem" }],
        sm: ["0.9375rem", { lineHeight: "1.5rem" }],
      },

      /* ── Brand color tokens ── */
      colors: {
        /* Light */
        "light-primary":          "#2E4D3D",
        "light-primary-hover":    "#243d30",
        "light-secondary":        "#D6CDBB",
        "light-tertiary":         "#7D8471",
        "light-bg":               "#F8F7F2",
        "light-surface":          "#FFFFFF",
        "light-hover":            "#F3F1EB",
        "light-text":             "#1C2B22",
        "light-text-sub":         "#7D8471",
        "light-text-muted":       "#B0ADA4",
        "light-border":           "#E8E4DB",
        "light-border-strong":    "#D6CDBB",

        /* Dark */
        "dark-primary":           "#173627",
        "dark-primary-hover":     "#1f4a34",
        "dark-secondary":         "#EBE2CF",
        "dark-tertiary":          "#492628",
        "dark-bg":                "#0D1410",
        "dark-surface":           "#111a14",
        "dark-surface-2":         "#162019",
        "dark-hover":             "#1a2a1d",
        "dark-text":              "#EBE2CF",
        "dark-text-sub":          "#9aab9e",
        "dark-text-muted":        "#5a6b5e",

        /* Shared */
        danger: {
          light: "#C0392B",
          dark:  "#c0614a",
        },
      },

      /* ── Border radius ── */
      borderRadius: {
        card:  "14px",
        btn:   "10px",
        input: "10px",
        pill:  "99px",
      },

      /* ── Shadows ── */
      boxShadow: {
        /* Light */
        "card-light":       "0 4px 16px -4px rgba(46,77,61,0.10)",
        "card-light-hover": "0 4px 20px -6px rgba(46,77,61,0.12)",
        "input-light":      "0 0 0 3px rgba(46,77,61,0.08)",
        "glow-light":       "0 0 16px rgba(46,77,61,0.18)",
        /* Dark */
        "card-dark":        "0 4px 20px -6px rgba(0,0,0,0.40)",
        "glow-dark":        "0 0 20px rgba(16,185,129,0.25)",
      },

      /* ── Animations ── */
      animation: {
        "pulse-glow":     "pulseGlow 2s ease-in-out infinite alternate",
        "fade-in":        "fadeIn 0.3s ease-in-out",
        "slide-up":       "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        blink:            "blink 1.2s ease-in-out infinite",
        float:            "float 8s ease-in-out infinite",
        "float-delayed":  "float-delayed 10s ease-in-out infinite",
        marquee:          "marquee 30s linear infinite",
      },

      keyframes: {
        pulseGlow: {
          "0%":   { boxShadow: "0 0 5px #10b981, 0 0 10px #10b981" },
          "100%": { boxShadow: "0 0 15px #10b981, 0 0 30px #10b981, 0 0 50px #10b98140" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%":   { opacity: "0", transform: "translateX(8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "0.2" },
          "50%":      { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "33%":      { transform: "translateY(-12px) rotate(1deg)" },
          "66%":      { transform: "translateY(8px) rotate(-1deg)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "33%":      { transform: "translateY(10px) rotate(-1.5deg)" },
          "66%":      { transform: "translateY(-14px) rotate(1.5deg)" },
        },
        marquee: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-33.333%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
