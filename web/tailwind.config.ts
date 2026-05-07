import type { Config } from "tailwindcss";

/**
 * The `项目驾驶舱` cosmic-console design lives almost entirely in styles.css
 * via CSS custom properties (--bg-0, --c-accent, etc.) so themes and density
 * can switch with a single attribute. Tailwind stays for layout primitives;
 * only the mono utility is reserved as a font alias the design's `.mono`
 * class also uses.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "SF Mono", "Cascadia Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
