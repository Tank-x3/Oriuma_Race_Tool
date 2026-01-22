import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Init from localStorage or OS
        const saved = localStorage.getItem('theme');
        const isDarkPreferred = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);

        setIsDark(isDarkPreferred);
        if (isDarkPreferred) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        const nextState = !isDark;
        setIsDark(nextState);
        localStorage.setItem('theme', nextState ? 'dark' : 'light');

        if (nextState) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
    );
};
