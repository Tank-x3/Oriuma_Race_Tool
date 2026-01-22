import React from 'react';
import { NotificationContainer } from '../ui/Notification';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Sparkles } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 selection:bg-primary-500/30">
            {/* Background Elements (Dark Mode Only usually, or adapted) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-0 dark:opacity-100 transition-opacity">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-md border-b border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 group cursor-default">
                        <div className="p-2 rounded-lg bg-gradient-to-tr from-primary-600 to-primary-400 shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform duration-300">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-accent-600 dark:from-primary-400 dark:to-accent-400">
                            オリウマレース集計ツール
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs font-mono text-slate-500">
                            v0.1.0 MVP
                        </div>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8 relative z-10 min-h-[calc(100vh-8rem)]">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 bg-slate-950/50 relative z-10">
                <div className="container mx-auto px-4 h-16 flex items-center justify-center text-sm text-slate-600">
                    <p>© 2026 Ori-Uma Race Aggregation Tool</p>
                </div>
            </footer>

            {/* Global Components */}
            <NotificationContainer />
        </div>
    );
};
