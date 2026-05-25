import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Palette, X, Sun, Moon, Check } from 'lucide-react';
import './ThemeSelector.css';

const ThemeSelector = ({ isOpen, onClose }) => {
    const { currentTheme, setTheme, lightThemes, darkThemes } = useTheme();

    if (!isOpen) return null;

    const handleThemeSelect = (themeId) => {
        setTheme(themeId);
    };

    return (
        <div className="theme-selector-overlay" onClick={onClose}>
            <div className="theme-selector-modal" onClick={(e) => e.stopPropagation()}>
                <div className="theme-selector-header">
                    <div className="theme-selector-title">
                        <Palette size={22} />
                        <span>Choose Theme</span>
                    </div>
                    <button className="theme-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="theme-sections">
                    {/* Light Themes */}
                    <div className="theme-section">
                        <div className="theme-section-header">
                            <Sun size={16} />
                            <span>Light Themes</span>
                        </div>
                        <div className="theme-grid">
                            {lightThemes.map((theme) => (
                                <button
                                    key={theme.id}
                                    className={`theme-swatch ${currentTheme === theme.id ? 'active' : ''}`}
                                    onClick={() => handleThemeSelect(theme.id)}
                                    style={{ '--swatch-color': theme.color }}
                                >
                                    <div className="swatch-preview">
                                        <div className="swatch-bg"></div>
                                        <div className="swatch-accent" style={{ background: theme.color }}></div>
                                    </div>
                                    <span className="swatch-name">{theme.name}</span>
                                    {currentTheme === theme.id && (
                                        <div className="swatch-check">
                                            <Check size={14} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dark Themes */}
                    <div className="theme-section">
                        <div className="theme-section-header">
                            <Moon size={16} />
                            <span>Dark Themes</span>
                        </div>
                        <div className="theme-grid">
                            {darkThemes.map((theme) => (
                                <button
                                    key={theme.id}
                                    className={`theme-swatch dark ${currentTheme === theme.id ? 'active' : ''}`}
                                    onClick={() => handleThemeSelect(theme.id)}
                                    style={{ '--swatch-color': theme.color }}
                                >
                                    <div className="swatch-preview dark">
                                        <div className="swatch-bg"></div>
                                        <div className="swatch-accent" style={{ background: theme.color }}></div>
                                    </div>
                                    <span className="swatch-name">{theme.name}</span>
                                    {currentTheme === theme.id && (
                                        <div className="swatch-check">
                                            <Check size={14} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeSelector;
