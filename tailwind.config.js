/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Deep modern dark theme palette
                background: "#0a0a0a",
                surface: "#171717",
                border: "#262626",
                primary: "#3b82f6",
                "primary-hover": "#2563eb",
                "text-main": "#ededed",
                "text-muted": "#a1a1aa"
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            keyframes: {
                "fade-in": {
                    "0%": { opacity: "0", transform: "translateY(5px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "slide-up": {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                shake: {
                    "0%, 100%": { transform: "translateX(0)" },
                    "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
                    "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
                },
            },
            animation: {
                "fade-in": "fade-in 0.2s ease-out",
                "slide-up": "slide-up 0.3s ease-out",
                shake: "shake 0.4s cubic-bezier(.36,.07,.19,.97) both",
            },
        },
    },
    plugins: [],
}
