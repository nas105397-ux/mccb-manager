/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 💡 font-mono を使った時の最優先フォントを Inconsolata に設定
        mono: ['Inconsolata', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
