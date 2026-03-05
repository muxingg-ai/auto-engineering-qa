/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#491eff",
          "primary-content": "#d4dbff",
          "secondary": "#f0f4ff",        // 浅蓝灰背景
          "secondary-content": "#1e293b", // 深色文字
          "accent": "#00cfbd",
          "accent-content": "#00100d",
          "neutral": "#2b3440",
          "neutral-content": "#d7dde4",
          "base-100": "#ffffff",
          "base-200": "#f2f2f2",
          "base-300": "#e5e6e6",
          "base-content": "#1f2937",
          "info": "#00b3f0",
          "info-content": "#000000",
          "success": "#00ca92",
          "success-content": "#000000",
          "warning": "#ffc22d",
          "warning-content": "#000000",
          "error": "#ff6f70",
          "error-content": "#000000",
        },
      },
    ],
  },
}
