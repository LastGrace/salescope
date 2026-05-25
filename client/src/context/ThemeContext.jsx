import React, { createContext, useContext, useState, useEffect } from 'react';

// Available themes
export const LIGHT_THEMES = [
    { id: 'light-rose', name: 'Rose', color: '#e11d48' },
    { id: 'light-ocean', name: 'Ocean', color: '#0891b2' },
    { id: 'light-emerald', name: 'Emerald', color: '#14b8a6' },
    { id: 'light-mint', name: 'Mint', color: '#00b894' },
    { id: 'light-slate', name: 'Slate', color: '#475569' },
    { id: 'light-royal', name: 'Royal', color: '#6366f1' },
    { id: 'light-stone', name: 'Stone', color: '#636e72' },
    { id: 'light-sunset', name: 'Sunset', color: '#ea580c' },
    { id: 'light-sky', name: 'Sky', color: '#0984e3' },
    { id: 'light-neon', name: 'Neon', color: '#d946ef' },
];

export const DARK_THEMES = [
    { id: 'dark-indigo', name: 'Indigo', color: '#6366f1' },
    { id: 'dark-crimson', name: 'Crimson', color: '#be123c' },
    { id: 'dark-forest', name: 'Forest', color: '#15803d' },
    { id: 'dark-slate', name: 'Slate', color: '#334155' },
    { id: 'dark-violet', name: 'Violet', color: '#7c3aed' },
    { id: 'dark-cyber', name: 'Cyber', color: '#00f2ff' },
    { id: 'dark-midnight', name: 'Midnight', color: '#3b82f6' },
    { id: 'dark-aurora', name: 'Aurora', color: '#22c55e' },
    { id: 'dark-amber', name: 'Amber', color: '#f59e0b' },
    { id: 'dark-fuchsia', name: 'Fuchsia', color: '#d946ef' },
];

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState(() => {
        const saved = localStorage.getItem('app-theme');
        return saved || 'light-rose';
    });

    useEffect(() => {
        document.body.setAttribute('data-theme', currentTheme);
        localStorage.setItem('app-theme', currentTheme);
    }, [currentTheme]);

    const isDarkMode = currentTheme.startsWith('dark-');

    const toggleMode = () => {
        if (isDarkMode) {
            // Switch to light-rose (default light)
            setCurrentTheme('light-rose');
        } else {
            // Switch to dark-indigo (default dark)
            setCurrentTheme('dark-indigo');
        }
    };

    const setTheme = (themeId) => {
        setCurrentTheme(themeId);
    };

    return (
        <ThemeContext.Provider value={{
            currentTheme,
            setTheme,
            isDarkMode,
            toggleMode,
            lightThemes: LIGHT_THEMES,
            darkThemes: DARK_THEMES
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeContext;
