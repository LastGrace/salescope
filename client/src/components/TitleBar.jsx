import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCw, X } from 'lucide-react';
import axios from 'axios';
import './TitleBar.css';

const TitleBar = () => {
    const navigate = useNavigate();
    const [storeName, setStoreName] = useState('');
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const fetchStoreName = async () => {
            try {
                const res = await axios.get('/api/settings/store');
                if (res.data && res.data.store_name) {
                    setStoreName(res.data.store_name);
                }
            } catch (err) {
                console.error('Failed to fetch store name for title bar:', err);
            }
        };
        fetchStoreName();

        const handleKeyDown = (e) => {
            // ALT + ` (backtick) shortcut
            if (e.altKey && e.code === 'Backquote') {
                setIsVisible(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isVisible) {
            document.body.classList.remove('title-bar-hidden');
        } else {
            document.body.classList.add('title-bar-hidden');
        }
    }, [isVisible]);

    const handleBack = () => {
        navigate(-1);
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleClose = () => {
        if (window.electronAPI && window.electronAPI.closeWindow) {
            window.electronAPI.closeWindow();
        }
    };

    if (!isVisible) return null;

    return (
        <div className="custom-title-bar">
            <div className="title-bar-drag-area">
                <div className="title-bar-info">
                    <img src="/Salescope.png" alt="" className="title-bar-logo" />
                    <span className="title-bar-text">
                        Salescope {storeName ? `- ${storeName}` : ''}
                    </span>
                </div>
            </div>

            <div className="title-bar-actions">
                <button
                    className="title-bar-btn"
                    onClick={handleBack}
                    title="Back (Esc)"
                >
                    <ArrowLeft size={16} />
                </button>
                <button
                    className="title-bar-btn"
                    onClick={handleRefresh}
                    title="Hard Refresh"
                >
                    <RotateCw size={16} />
                </button>
            </div>

            <div className="window-controls">
                <button className="window-btn min-btn" onClick={() => window.electronAPI?.minimizeApp?.()}>
                    <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="5.5" width="8" height="1" fill="currentColor" /></svg>
                </button>
                <button className="window-btn close-btn" onClick={handleClose}>
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
