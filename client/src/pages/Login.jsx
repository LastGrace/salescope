import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Store } from 'lucide-react';
import '../styles/Login.css';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [storeSettings, setStoreSettings] = useState(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Fetch store settings for login logo
        const fetchSettings = async () => {
            try {
                const res = await axios.get('/api/settings/store');
                setStoreSettings(res.data);
            } catch (err) {
                console.error("Failed to load store settings");
            }
        };
        fetchSettings();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const success = await login(username, password);
        if (success) {
            navigate('/dashboard');
        } else {
            setError('Invalid credentials');
        }
    };

    return (
        <div className="login-container">
            {/* 1. App Header (RetailDesk) */}
            <div className="login-app-header">
                <div className="logo-container-static">
                    <div className="logo-icon-wrapper logo-icon-centered">
                        <img src="/Salescope.png" alt="SALESCOPE" className="logo-image" />
                    </div>
                    <span className="logo-text-static" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 'bold', display: 'flex', gap: '0' }}>
                        <span style={{ color: 'var(--primary)' }}>SALE</span>
                        <span style={{ color: 'var(--text-main)', opacity: 0.8 }}>SCOPE</span>
                    </span>
                </div>
            </div>

            {/* 2. Main Content (Flex Row) */}
            <div className="login-content-centered">
                <form className="login-card" onSubmit={handleSubmit}>
                    <div className="login-header">
                        {/* Ensure Logo is always shown, fallback to /Salescope.png */}
                        <div className="store-logo-wrapper">
                            <img
                                src={storeSettings?.login_logo_url || '/Salescope.png'}
                                alt="Store Logo"
                                className="store-logo-in-card"
                                style={{
                                    width: storeSettings?.login_logo_width || '200px',
                                    height: storeSettings?.login_logo_height || 'auto',
                                    maxWidth: '100%'
                                }}
                                onError={(e) => { e.target.onerror = null; e.target.src = '/Salescope.png'; }}
                            />
                        </div>

                        <h2 className="login-title">Sign in to your account</h2>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group-mb">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            className="input w-full"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="form-group-lg-mb">
                        <label className="form-label">Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input w-full"
                                style={{ paddingRight: '2.5rem' }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-full-width">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
