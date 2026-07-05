import React from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Copy, Check, AlertTriangle, RefreshCw, LogOut, Calendar, User, Clock } from 'lucide-react';

const Activation = ({ licenseStatus, onActivated }) => {
  const navigate = useNavigate();
  const [activationKey, setActivationKey] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');
  const [isCopied, setIsCopied] = React.useState(false);
  const [showRenewForm, setShowRenewForm] = React.useState(false);

  const hwid = licenseStatus?.hwid || { motherboard: '', cpu: '', disk: '', mac: '' };
  
  // Format the HWID string to send to the developer
  const hwidString = `BOARD:${hwid.motherboard}|CPU:${hwid.cpu}|DISK:${hwid.disk}|MAC:${hwid.mac}`;

  const handleCopyHWID = () => {
    navigator.clipboard.writeText(hwidString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!activationKey.trim()) {
      setErrorMsg('Please enter your license key.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axios.post('/api/license/activate', { key: activationKey.trim() });
      if (res.data.success) {
        if (res.data.pending) {
          // Key is valid but needs admin approval — refresh status to show pending UI
          setSuccessMsg('Key accepted! Waiting for admin approval...');
          setTimeout(() => {
            onActivated();
          }, 1500);
        } else {
          // Fully activated
          setSuccessMsg('License activated successfully! Unlocking SaleScope...');
          setTimeout(() => {
            onActivated();
            setShowRenewForm(false);
          }, 2000);
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid license key. Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async () => {
    const confirmDeactivate = window.confirm(
      "WARNING: Are you absolutely sure you want to deactivate and revoke this software license?\n\nThis will lock all POS billing features immediately. You will need a new activation key to unlock it again."
    );
    if (!confirmDeactivate) return;

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axios.post('/api/license/deactivate');
      if (res.data.success) {
        setSuccessMsg('License deactivated successfully. Access locked.');
        setTimeout(() => {
          onActivated(); // Refresh license status
        }, 2000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to deactivate license.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLicensed = licenseStatus.status === 'licensed';
  const isPending = licenseStatus.status === 'pending';
  const payload = licenseStatus.payload || {};
  const daysLeft = licenseStatus.daysLeft;

  // Auto-poll license status every 10 seconds while pending
  React.useEffect(() => {
    if (!isPending) return;
    const interval = setInterval(() => {
      onActivated(); // re-checks /api/license/status
    }, 10000);
    return () => clearInterval(interval);
  }, [isPending, onActivated]);

  return (
    <div className="activation-container">
      <div className="activation-card">
        {isPending ? (
          /* PENDING ADMIN APPROVAL SCREEN */
          <div className="license-dashboard">
            <div className="activation-header">
              <div className="icon-badge pending animate-pulse-slow">
                <Clock className="shield-icon" size={36} />
              </div>
              <h1>Awaiting Approval</h1>
              <p className="subtitle pending-text">Activation Request Submitted</p>
            </div>

            <div className="status-banner warning">
              <Clock className="banner-icon" />
              <div>
                <h3>Pending Admin Approval</h3>
                <p>{licenseStatus.reason || 'Your license key has been verified and an activation request has been sent. The administrator needs to approve this device before SaleScope can be unlocked.'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px 0' }}>
              <span className="spinner" style={{ width: '24px', height: '24px', border: '3px solid #334155', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Checking for approval every 10 seconds...</span>
            </div>
          </div>
        ) : isLicensed && !showRenewForm ? (
          /* PREMIUM ACTIVATED DASHBOARD */
          <div className="license-dashboard">
            <div className="activation-header">
              <div className="icon-badge success animate-pulse-slow">
                <Shield className="shield-icon success-color" size={36} />
              </div>
              <h1>SaleScope Activated</h1>
              <p className="subtitle success-text">Professional Offline License</p>
            </div>

            <div className="license-info-grid">
              <div className="info-card">
                <div className="info-card-header">
                  <User size={14} className="info-icon" />
                  <span>Licensed To</span>
                </div>
                <div className="info-card-value">{payload.issuedTo || 'Premium Subscriber'}</div>
              </div>

              <div className="info-card">
                <div className="info-card-header">
                  <Calendar size={14} className="info-icon" />
                  <span>Expiration Date</span>
                </div>
                <div className="info-card-value">
                  {payload.expiry ? new Date(payload.expiry).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Lifetime License'}
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-header">
                  <Clock size={14} className="info-icon" />
                  <span>Days Remaining</span>
                </div>
                <div className="info-card-value highlight-green">
                  {daysLeft !== undefined && daysLeft !== null ? (
                    `${daysLeft} Days`
                  ) : (
                    'Unlimited'
                  )}
                </div>
              </div>

              <div className="info-card">
                <div className="info-card-header">
                  <Shield size={14} className="info-icon" />
                  <span>Security Mode</span>
                </div>
                <div className="info-card-value">100% Secure Offline</div>
              </div>
            </div>

            {/* Hardware Profile ID Box */}
            <div className="hwid-section compact-hwid">
              <h3>Locked Hardware Profile ID:</h3>
              <div className="hwid-box">
                <span className="hwid-text">{hwidString}</span>
                <button 
                  className={`copy-btn ${isCopied ? 'copied' : ''}`} 
                  onClick={handleCopyHWID}
                  title="Copy Profile ID"
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="license-dashboard-actions">
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    await axios.post('/api/license/sync');
                    onActivated();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="btn-secondary sync-toggle-btn"
                disabled={isLoading}
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                Sync License
              </button>
              <button 
                onClick={() => setShowRenewForm(true)}
                className="btn-secondary renew-toggle-btn"
              >
                <KeyRound size={16} />
                Renew License
              </button>
              <button 
                onClick={() => navigate('/dashboard')}
                className="go-dashboard-btn"
              >
                Go to POS
              </button>
            </div>

            <div className="license-dashboard-deactivate" style={{ marginTop: '12px' }}>
              <button 
                onClick={handleDeactivate}
                className="deactivate-btn-red"
                style={{
                  width: '100%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#fca5a5',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                }}
              >
                <LogOut size={16} />
                Deactivate & Revoke License
              </button>
            </div>
          </div>
        ) : (
          /* LICENSE ACTIVATION FORM */
          <>
            {/* Card Header */}
            <div className="activation-header">
              <div className="icon-badge">
                <Shield className="shield-icon" size={36} />
              </div>
              <h1>SaleScope Activation</h1>
              <p className="subtitle">Enterprise Security & Licensing Manager</p>
            </div>

            {/* Dynamic Warning Banners */}
            {licenseStatus.status === 'clock_tampered' && (
              <div className="status-banner danger animate-pulse">
                <AlertTriangle className="banner-icon" />
                <div>
                  <h3>Clock Tampering Detected</h3>
                  <p>{licenseStatus.reason || 'Your PC system clock has been manipulated. Please correct the system date and time to continue.'}</p>
                </div>
              </div>
            )}

            {!isLicensed && licenseStatus.status === 'trial_expired' && (
              <div className="status-banner danger animate-pulse-slow">
                <AlertTriangle className="banner-icon" />
                <div>
                  <h3>License Required</h3>
                  <p>This copy of SaleScope is not activated. Please enter a valid offline activation key below to unlock and access the POS system.</p>
                </div>
              </div>
            )}

            {!isLicensed && licenseStatus.status === 'invalid' && (
              <div className="status-banner danger">
                <AlertTriangle className="banner-icon" />
                <div>
                  <h3>License Expired or Invalid</h3>
                  <p>Cryptographic verification of your license key failed. Please enter a valid offline activation key below.</p>
                </div>
              </div>
            )}

            {/* Hardware Fingerprint Section */}
            <div className="hwid-section">
              <h3>Your Hardware Profile ID:</h3>
              <div className="hwid-box">
                <span className="hwid-text">{hwidString}</span>
                <button 
                  className={`copy-btn ${isCopied ? 'copied' : ''}`} 
                  onClick={handleCopyHWID}
                  title="Copy Profile ID"
                  type="button"
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                  {isCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="hwid-instruction">
                Please share the hardware profile ID above with the SaleScope team to generate your secure license key.
              </p>
            </div>

            {/* License Input Form */}
            <form onSubmit={handleActivate} className="activation-form">
              <div className="input-group">
                <label htmlFor="key">Enter Activation Key</label>
                <div className="input-with-icon">
                  <KeyRound className="input-icon" size={18} />
                  <input
                    id="key"
                    type="text"
                    placeholder="Paste your cryptographic activation key here"
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    disabled={isLoading || successMsg}
                    autoComplete="off"
                  />
                </div>
              </div>

              {errorMsg && <div className="alert-message error">{errorMsg}</div>}
              {successMsg && <div className="alert-message success">{successMsg}</div>}

              <button 
                type="submit" 
                className="activate-btn" 
                disabled={isLoading || successMsg}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="spinner-icon animate-spin" size={18} />
                    Verifying Key Offline...
                  </>
                ) : (
                  'Activate Software'
                )}
              </button>
            </form>

            {isLicensed && showRenewForm && (
              <button 
                type="button"
                onClick={() => {
                  setShowRenewForm(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="btn-secondary"
                style={{
                  width: '100%',
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                Back to Active Details
              </button>
            )}
          </>
        )}

        {/* Footer info */}
        <div className="activation-footer">
          <p>Locked strictly to this hardware config. Offline execution authorized.</p>
        </div>
      </div>

      <style>{`
        .activation-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          padding: 20px;
          font-family: 'Inter', system-ui, sans-serif;
          color: #f8fafc;
        }

        .activation-card {
          background: rgba(30, 41, 59, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
          width: 100%;
          max-width: 580px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .activation-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .icon-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
          border-radius: 18px;
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
          margin-bottom: 20px;
        }

        .icon-badge.success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 10px 20px rgba(5, 150, 105, 0.3);
        }

        .icon-badge.pending {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 10px 20px rgba(245, 158, 11, 0.3);
        }

        .shield-icon {
          color: #ffffff;
        }

        .success-color {
          color: #ffffff;
        }

        .success-text {
          color: #34d399 !important;
          font-weight: 600;
        }

        .pending-text {
          color: #fbbf24 !important;
          font-weight: 600;
        }

        .activation-header h1 {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin: 0 0 4px 0;
          background: linear-gradient(to right, #ffffff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          font-size: 13px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0;
        }

        .status-banner {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 25px;
          border: 1px solid;
          font-size: 13.5px;
          line-height: 1.5;
        }

        .status-banner.danger {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.25);
          color: #fca5a5;
        }

        .status-banner.warning {
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.25);
          color: #fde047;
        }

        .banner-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .status-banner h3 {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: inherit;
        }

        .status-banner p {
          margin: 0;
        }

        .hwid-section {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 25px;
        }

        .hwid-section h3 {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 10px 0;
        }

        .hwid-box {
          display: flex;
          align-items: center;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 4px 4px 4px 12px;
          gap: 10px;
        }

        .hwid-text {
          font-family: 'JetBrains Mono', monospace, Consolas, Courier;
          font-size: 11px;
          color: #38bdf8;
          word-break: break-all;
          flex-grow: 1;
        }

        .copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          color: #cbd5e1;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .copy-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }

        .copy-btn.copied {
          background: #22c55e;
          color: #ffffff;
        }

        .hwid-instruction {
          font-size: 12px;
          color: #94a3b8;
          margin: 10px 0 0 0;
          line-height: 1.4;
        }

        .input-group {
          margin-bottom: 20px;
        }

        .input-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #cbd5e1;
          margin-bottom: 8px;
        }

        .input-with-icon {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .input-with-icon input {
          width: 100%;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 14px 14px 14px 44px;
          color: #ffffff;
          font-family: inherit;
          font-size: 14px;
          transition: all 0.2s;
        }

        .input-with-icon input:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .alert-message {
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 20px;
          font-weight: 500;
        }

        .alert-message.error {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .alert-message.success {
          background: rgba(34, 197, 94, 0.15);
          color: #86efac;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .activate-btn {
          width: 100%;
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
          color: #ffffff;
          border: none;
          padding: 14px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }

        .activate-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(99, 102, 241, 0.3);
        }

        .activate-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .activate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        .activation-footer {
          margin-top: 30px;
          text-align: center;
          font-size: 11px;
          color: #64748b;
        }

        /* PREMIUM LICENSE STYLES */
        .license-info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 25px;
        }

        .info-card {
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
        }

        .info-icon {
          color: #64748b;
        }

        .info-card-value {
          font-size: 14px;
          font-weight: 600;
          color: #f8fafc;
          word-break: break-word;
        }

        .highlight-green {
          color: #34d399 !important;
        }

        .compact-hwid {
          margin-bottom: 25px;
          padding: 14px;
        }

        .compact-hwid h3 {
          margin-bottom: 6px;
        }

        .license-dashboard-actions {
          display: flex;
          gap: 12px;
        }

        .btn-secondary {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .go-dashboard-btn {
          flex: 1;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          border: none;
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .go-dashboard-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(5, 150, 105, 0.3);
        }

        /* Animations */
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-pulse-slow {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .7; }
        }
      `}</style>
    </div>
  );
};

export default Activation;
