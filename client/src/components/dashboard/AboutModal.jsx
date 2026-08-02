import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Globe, Mail, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AboutModal = ({ onClose, licenseStatus }) => {
    const navigate = useNavigate();
    const [aboutTab, setAboutTab] = useState('website'); // 'website' or 'email'

    // Open links in default system browser (Electron support)
    const openExternal = (url) => {
        if (window.electron?.shell?.openExternal) {
            window.electron.shell.openExternal(url);
        } else if (window.require) {
            try {
                const { shell } = window.require('electron');
                shell.openExternal(url);
            } catch (e) {
                window.open(url, '_blank');
            }
        } else {
            window.open(url, '_blank');
        }
    };

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="about-modal" onClick={e => e.stopPropagation()}>
                <button className="about-close-btn" onClick={onClose}>
                    <X size={18} />
                </button>
                <div className="about-header">
                    <img
                        src="/Salescope.png"
                        alt="Salescope"
                        className="about-logo"
                    />
                    <h2>Salescope</h2>
                    <p className="about-version">Retail Management System</p>
                    
                    {/* License Status Badge */}
                    {licenseStatus && (
                        <div 
                            className={`about-license-badge ${licenseStatus.status === 'licensed' ? 'active' : 'inactive'}`}
                            onClick={() => navigate('/activation')}
                            style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: licenseStatus.status === 'licensed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: licenseStatus.status === 'licensed' ? '#34d399' : '#f87171', border: licenseStatus.status === 'licensed' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                            title="Click to manage license"
                        >
                            <Shield size={14} />
                            <span>
                                {licenseStatus.status === 'licensed'
                                    ? `License: ${licenseStatus.daysLeft !== null && licenseStatus.daysLeft !== undefined ? `${licenseStatus.daysLeft} Days Left` : 'Active'}`
                                    : 'License Not Active'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="about-tabs">
                    <button
                        className={`about-tab ${aboutTab === 'website' ? 'active' : ''}`}
                        onClick={() => setAboutTab('website')}
                    >
                        <Globe size={16} />
                        Website
                    </button>
                    <button
                        className={`about-tab ${aboutTab === 'email' ? 'active' : ''}`}
                        onClick={() => setAboutTab('email')}
                    >
                        <Mail size={16} />
                        Email
                    </button>
                </div>

                <div className="about-tab-content">
                    {aboutTab === 'website' ? (
                        <div className="about-content-card" onClick={() => openExternal('https://salescope.software')}>
                            <div className="about-content-icon">
                                <Globe size={32} />
                            </div>
                            <div className="about-content-details">
                                <h3>Official Website</h3>
                                <p>salescope.software</p>
                            </div>
                            <ExternalLink size={18} className="about-content-arrow" />
                        </div>
                    ) : (
                        <div className="about-content-card" onClick={() => openExternal('mailto:salescopepos@gmail.com')}>
                            <div className="about-content-icon">
                                <Mail size={32} />
                            </div>
                            <div className="about-content-details">
                                <h3>Support Email</h3>
                                <p>salescopepos@gmail.com</p>
                            </div>
                            <ExternalLink size={18} className="about-content-arrow" />
                        </div>
                    )}
                </div>

                <div className="about-footer">
                    <p>© {new Date().getFullYear()} Salescope. All rights reserved.</p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AboutModal;
