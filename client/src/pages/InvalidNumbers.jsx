import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    AlertTriangle, CheckCircle, Copy, RefreshCcw, Users,
    AlertCircle, Smartphone, Trash2, Download, Play, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../styles/InvalidNumbers.css';

const InvalidNumbers = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState(null);
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [copied, setCopied] = useState(false);

    // Scan Stats (Persisted in localStorage)
    const [total, setTotal] = useState(() => Number(localStorage.getItem('salescope_audit_total') || 0));
    const [scanned, setScanned] = useState(() => Number(localStorage.getItem('salescope_audit_scanned') || 0));
    const [verifiedCount, setVerifiedCount] = useState(() => Number(localStorage.getItem('salescope_audit_verified_count') || 0));
    const [notOnWhatsApp, setNotOnWhatsApp] = useState(() => {
        try { return JSON.parse(localStorage.getItem('salescope_audit_invalid_list')) || []; } catch { return []; }
    });
    const [scannedIds, setScannedIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem('salescope_audit_scanned_ids')) || []; } catch { return []; }
    });

    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState('Calculating...');

    // Single Phone Check State
    const [singlePhone, setSinglePhone] = useState('');
    const [singleChecking, setSingleChecking] = useState(false);
    const [singleResult, setSingleResult] = useState(null);

    // Multi-select State
    const [selectedIds, setSelectedIds] = useState([]);

    // Fetch initial customer total quietly on load without auto-triggering scan
    useEffect(() => {
        const fetchInitialTotal = async () => {
            try {
                const res = await axios.get('/api/customers/invalid-numbers');
                const list = res.data.customers || [];
                const currentTotal = list.length;
                setTotal(currentTotal);
                localStorage.setItem('salescope_audit_total', currentTotal.toString());

                const dbIds = list.map(c => c.id);
                const cachedScannedIds = JSON.parse(localStorage.getItem('salescope_audit_scanned_ids')) || [];
                const validScannedIds = cachedScannedIds.filter(id => dbIds.includes(id));

                if (validScannedIds.length !== cachedScannedIds.length) {
                    setScannedIds(validScannedIds);
                    localStorage.setItem('salescope_audit_scanned_ids', JSON.stringify(validScannedIds));

                    const newScanned = validScannedIds.length;
                    setScanned(newScanned);
                    localStorage.setItem('salescope_audit_scanned', newScanned.toString());

                    const cachedInvalid = JSON.parse(localStorage.getItem('salescope_audit_invalid_list')) || [];
                    const validInvalid = cachedInvalid.filter(c => dbIds.includes(c.id));
                    setNotOnWhatsApp(validInvalid);
                    localStorage.setItem('salescope_audit_invalid_list', JSON.stringify(validInvalid));

                    const newVerified = Math.max(0, newScanned - validInvalid.length);
                    setVerifiedCount(newVerified);
                    localStorage.setItem('salescope_audit_verified_count', newVerified.toString());
                }
                setLoading(false);
            } catch (err) {
                console.error('Error fetching initial total:', err);
                setLoading(false);
            }
        };
        fetchInitialTotal();
    }, []);

    const runScan = async (onlyUnscanned = false) => {
        setScanning(true);
        setError(null);
        setIsDisconnected(false);
        setEstimatedTimeRemaining('Calculating...');

        let customersList = [];
        try {
            const res = await axios.get('/api/customers/invalid-numbers');
            customersList = res.data.customers || [];
        } catch (err) {
            const resData = err.response?.data;
            if (resData?.error_type === 'whatsapp_disconnected') {
                setIsDisconnected(true);
                setScanning(false);
            } else {
                setError(err.response?.data?.message || 'Failed to retrieve customers');
                setScanning(false);
            }
            return;
        }

        if (customersList.length === 0) {
            setScanning(false);
            toast.error('No customers found in database');
            return;
        }

        let toScan = [];
        let currentScannedIds = [];
        let currentInvalidList = [];
        let currentVerifiedCount = 0;

        if (onlyUnscanned) {
            try {
                currentScannedIds = JSON.parse(localStorage.getItem('salescope_audit_scanned_ids')) || [];
                currentInvalidList = JSON.parse(localStorage.getItem('salescope_audit_invalid_list')) || [];
                currentVerifiedCount = Number(localStorage.getItem('salescope_audit_verified_count') || 0);
            } catch (e) {
                currentScannedIds = [];
                currentInvalidList = [];
                currentVerifiedCount = 0;
            }

            toScan = customersList.filter(c => !currentScannedIds.includes(c.id));
            if (toScan.length === 0) {
                setScanning(false);
                toast.success('All contacts have already been scanned! Click Re-run Full Scan to check again.');
                return;
            }
            setTotal(customersList.length);
        } else {
            toScan = customersList;
            setTotal(customersList.length);
            setScanned(0);
            setVerifiedCount(0);
            setNotOnWhatsApp([]);
            setScannedIds([]);
            setSelectedIds([]);

            localStorage.removeItem('salescope_audit_scanned_ids');
            localStorage.removeItem('salescope_audit_invalid_list');
            localStorage.removeItem('salescope_audit_verified_count');
            localStorage.removeItem('salescope_audit_total');
            localStorage.removeItem('salescope_audit_scanned');
        }

        const batchSize = 10;
        const totalToScan = toScan.length;
        let localScannedCount = onlyUnscanned ? currentScannedIds.length : 0;
        let localVerifiedCount = onlyUnscanned ? currentVerifiedCount : 0;
        const localInvalidList = onlyUnscanned ? [...currentInvalidList] : [];
        const localScannedIds = onlyUnscanned ? [...currentScannedIds] : [];

        const startTime = Date.now();
        let loopScanned = 0;

        for (let i = 0; i < totalToScan; i += batchSize) {
            const batch = toScan.slice(i, i + batchSize);
            try {
                const response = await axios.post('/api/customers/check-whatsapp-batch', { customers: batch });
                const batchResults = response.data.results || [];

                for (const result of batchResults) {
                    // If the server failed to verify this specific number, skip it so it remains unscanned.
                    if (result.error && result.error.startsWith('Verification Failed')) {
                        continue;
                    }

                    loopScanned++;
                    localScannedCount++;
                    localScannedIds.push(result.id);
                    if (result.isRegistered) {
                        localVerifiedCount++;
                    } else {
                        localInvalidList.push(result);
                    }
                }

                setScanned(localScannedCount);
                setVerifiedCount(localVerifiedCount);
                setNotOnWhatsApp([...localInvalidList]);
                setScannedIds([...localScannedIds]);

                localStorage.setItem('salescope_audit_total', customersList.length.toString());
                localStorage.setItem('salescope_audit_scanned', localScannedCount.toString());
                localStorage.setItem('salescope_audit_verified_count', localVerifiedCount.toString());
                localStorage.setItem('salescope_audit_invalid_list', JSON.stringify(localInvalidList));
                localStorage.setItem('salescope_audit_scanned_ids', JSON.stringify(localScannedIds));

                const elapsedTime = Date.now() - startTime;
                const averageTimePerContact = elapsedTime / loopScanned;
                const remaining = totalToScan - loopScanned;
                const remainingSeconds = Math.round((remaining * averageTimePerContact) / 1000);

                if (remaining <= 0) {
                    setEstimatedTimeRemaining('Complete');
                } else if (remainingSeconds < 60) {
                    setEstimatedTimeRemaining(`${remainingSeconds}s`);
                } else {
                    const mins = Math.floor(remainingSeconds / 60);
                    const secs = remainingSeconds % 60;
                    setEstimatedTimeRemaining(`${mins}m ${secs}s`);
                }

            } catch (batchErr) {
                console.error('Batch verification failed:', batchErr);
                const resData = batchErr.response?.data;
                if (resData?.error_type === 'whatsapp_disconnected' || batchErr.response?.status === 400) {
                    setIsDisconnected(true);
                    setScanning(false);
                    return;
                }
                // Stop scanning on fatal batch error
                toast.error(`Verification interrupted: ${batchErr.message}`);
                break;

                localStorage.setItem('salescope_audit_scanned', localScannedCount.toString());
                localStorage.setItem('salescope_audit_invalid_list', JSON.stringify(localInvalidList));
                localStorage.setItem('salescope_audit_scanned_ids', JSON.stringify(localScannedIds));
            }
        }

        setScanning(false);
        setEstimatedTimeRemaining('Complete');
    };

    const checkSingleNumber = async (e) => {
        e.preventDefault();
        if (!singlePhone || singlePhone.trim() === '') {
            toast.error('Please enter a phone number to check');
            return;
        }
        setSingleChecking(true);
        setSingleResult(null);
        try {
            const res = await axios.post('/api/customers/check-single-whatsapp', { phone: singlePhone });
            if (res.data.success) {
                setSingleResult({ checked: true, phone: res.data.phone, isRegistered: res.data.isRegistered, error: null });
                if (res.data.isRegistered) {
                    toast.success('Number is active on WhatsApp!');
                } else {
                    toast.error('Number is NOT on WhatsApp!');
                }
            }
        } catch (err) {
            const resData = err.response?.data;
            if (resData?.error_type === 'whatsapp_disconnected') setIsDisconnected(true);
            setSingleResult({ checked: true, phone: singlePhone, isRegistered: false, error: err.response?.data?.message || 'Verification failed. WhatsApp might be disconnected.' });
            toast.error(err.response?.data?.message || 'Single check failed');
        } finally {
            setSingleChecking(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete customer "${name}" from the database?`)) return;
        try {
            const res = await axios.delete(`/api/customers/${id}`);
            toast.success(res.data.message || 'Customer deleted successfully');

            const updatedInvalid = notOnWhatsApp.filter(c => c.id !== id);
            const updatedScannedIds = scannedIds.filter(sid => sid !== id);

            setNotOnWhatsApp(updatedInvalid);
            setScannedIds(updatedScannedIds);
            setSelectedIds(prev => prev.filter(sid => sid !== id));

            const newTotal = Math.max(0, total - 1);
            const newScanned = Math.max(0, scanned - 1);
            setTotal(newTotal);
            setScanned(newScanned);

            localStorage.setItem('salescope_audit_total', newTotal.toString());
            localStorage.setItem('salescope_audit_scanned', newScanned.toString());
            localStorage.setItem('salescope_audit_invalid_list', JSON.stringify(updatedInvalid));
            localStorage.setItem('salescope_audit_scanned_ids', JSON.stringify(updatedScannedIds));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete customer. They might have active sales history.');
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        setSelectedIds(selectedIds.length === notOnWhatsApp.length ? [] : notOnWhatsApp.map(c => c.id));
    };

    const handleBulkDelete = async () => {
        const count = selectedIds.length;
        if (count === 0) return;
        if (!window.confirm(`Are you sure you want to delete the ${count} selected customers?`)) return;
        try {
            const res = await axios.post('/api/customers/bulk-delete', { ids: selectedIds });
            toast.success(res.data.message || `${res.data.deleted} customers deleted.`);
            if (res.data.skipped > 0) toast.error(`${res.data.skipped} skipped (they have sales history/credits)`);

            const skippedIds = (res.data.skippedReasons || []).map(r => r.id);
            const deletedIds = selectedIds.filter(id => !skippedIds.includes(id));

            const updatedInvalid = notOnWhatsApp.filter(c => !deletedIds.includes(c.id));
            const updatedScannedIds = scannedIds.filter(id => !deletedIds.includes(id));

            setNotOnWhatsApp(updatedInvalid);
            setScannedIds(updatedScannedIds);
            setSelectedIds(skippedIds);

            const newTotal = Math.max(0, total - deletedIds.length);
            const newScanned = Math.max(0, scanned - deletedIds.length);
            setTotal(newTotal);
            setScanned(newScanned);

            localStorage.setItem('salescope_audit_total', newTotal.toString());
            localStorage.setItem('salescope_audit_scanned', newScanned.toString());
            localStorage.setItem('salescope_audit_invalid_list', JSON.stringify(updatedInvalid));
            localStorage.setItem('salescope_audit_scanned_ids', JSON.stringify(updatedScannedIds));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk delete failed');
        }
    };

    const copyAsCSV = () => {
        if (notOnWhatsApp.length === 0) return;
        const headers = 'ID,Name,Phone,Email,Added On,Status';
        const rows = notOnWhatsApp.map(c =>
            `${c.id},"${c.name}","${c.stored_phone}","${c.email}","${c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}","${c.error || 'Not registered on WhatsApp'}"`
        );
        navigator.clipboard.writeText([headers, ...rows].join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadCSV = () => {
        if (notOnWhatsApp.length === 0) return;
        const headers = 'ID,Name,Phone,Email,Added On,Status';
        const rows = notOnWhatsApp.map(c =>
            `${c.id},"${c.name}","${c.stored_phone}","${c.email}","${c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}","${c.error || 'Not registered on WhatsApp'}"`
        );
        const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'));
        const link = document.createElement('a');
        link.setAttribute('href', csvContent);
        link.setAttribute('download', `invalid_whatsapp_contacts_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Downloaded CSV successfully');
    };

    if (loading) {
        return (
            <div className="inv-wrapper">
                <div className="inv-loading">
                    <div className="inv-spinner" />
                    <p>Connecting to server and retrieving customer records...</p>
                </div>
            </div>
        );
    }

    if (isDisconnected) {
        return (
            <div className="inv-wrapper">
                <div className="inv-empty-state" style={{ minHeight: '50vh' }}>
                    <Smartphone size={64} className="icon-warning" style={{ animation: 'pulse 2s infinite' }} />
                    <h3>WhatsApp Disconnected</h3>
                    <p>To verify customer phone numbers on WhatsApp, an active connection is required. Please scan the QR code to connect.</p>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button className="inv-btn primary" onClick={() => navigate('/whatsapp-bulk')}>Connect WhatsApp</button>
                        <button className="inv-btn ghost" onClick={() => { setIsDisconnected(false); runScan(true); }}>
                            <RefreshCcw size={14} /> Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="inv-wrapper">
                <div className="inv-empty-state">
                    <AlertCircle size={48} style={{ color: '#ef4444' }} />
                    <h3>Audit Failed</h3>
                    <p>{error}</p>
                    <button className="inv-btn primary" onClick={() => runScan(true)}>Retry</button>
                </div>
            </div>
        );
    }

    const hasInvalid = notOnWhatsApp.length > 0;
    const unscannedCount = Math.max(0, total - scanned);
    const progressPct = total > 0 ? (scanned / total) * 100 : 0;

    return (
        <div className="inv-wrapper">
            {/* ── Header ── */}
            <header className="inv-header">
                <div className="inv-header-left">
                    <div className="inv-header-icon">
                        <Smartphone size={22} />
                    </div>
                    <div>
                        <h1>WhatsApp Registration Audit</h1>
                        <p>Verify which customer numbers are active on WhatsApp</p>
                    </div>
                </div>
                <div className="inv-header-actions">
                    <button
                        className="inv-btn primary"
                        onClick={() => runScan(true)}
                        disabled={scanning || unscannedCount === 0}
                    >
                        <Play size={14} />
                        {scanning ? 'Scanning...' : `Scan New (${unscannedCount})`}
                    </button>
                    <button
                        className="inv-btn ghost"
                        onClick={() => runScan(false)}
                        disabled={scanning}
                    >
                        <RefreshCcw size={14} style={{ animation: scanning && unscannedCount === total ? 'inv-spin 1.5s linear infinite' : 'none' }} />
                        Full Re-scan
                    </button>
                </div>
            </header>

            {/* ── Progress Bar ── */}
            {scanning && (
                <div className="inv-progress-card">
                    <div className="inv-progress-info">
                        <span>
                            Scanning: <strong>{scanned}</strong> / <strong>{total}</strong> customers
                        </span>
                        <div className="inv-progress-eta">
                            <Clock size={13} />
                            <span>Est. remaining:</span>
                            <strong>{estimatedTimeRemaining}</strong>
                        </div>
                    </div>
                    <div className="inv-progress-track">
                        <div className="inv-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                </div>
            )}

            {/* ── Stats Row ── */}
            <div className="inv-stats-row">
                <div className="inv-stat-card total">
                    <div className="inv-stat-icon"><Users size={20} /></div>
                    <div>
                        <div className="inv-stat-value">{total}</div>
                        <div className="inv-stat-label">Total Customers</div>
                    </div>
                </div>
                <div className="inv-stat-card warning">
                    <div className="inv-stat-icon"><Smartphone size={20} /></div>
                    <div>
                        <div className="inv-stat-value">{scanned}</div>
                        <div className="inv-stat-label">Scanned</div>
                    </div>
                </div>
                <div className="inv-stat-card success">
                    <div className="inv-stat-icon"><CheckCircle size={20} /></div>
                    <div>
                        <div className="inv-stat-value">{verifiedCount}</div>
                        <div className="inv-stat-label">Active on WhatsApp</div>
                    </div>
                </div>
                <div className="inv-stat-card danger">
                    <div className="inv-stat-icon">
                        {hasInvalid ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    </div>
                    <div>
                        <div className="inv-stat-value">{notOnWhatsApp.length}</div>
                        <div className="inv-stat-label">Not on WhatsApp</div>
                    </div>
                </div>
            </div>

            {/* ── Info Grid ── */}
            <div className="inv-info-grid">
                {/* Audit Criteria */}
                <div className="inv-rules-box">
                    <h3 className="inv-section-title">📋 Audit Criteria</h3>
                    <div className="inv-rules-grid" style={{ gridTemplateColumns: '1fr', marginTop: '0.85rem' }}>
                        <div className="inv-rule valid">
                            <CheckCircle size={16} />
                            <div>
                                <strong>Active Accounts</strong>
                                <span>Registered on WhatsApp — ready for marketing</span>
                            </div>
                        </div>
                        <div className="inv-rule invalid">
                            <AlertTriangle size={16} />
                            <div>
                                <strong>Inactive / Unregistered</strong>
                                <span>No WhatsApp registration found or number malformatted</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Number Checker */}
                <div className="inv-single-checker">
                    <h3 className="inv-section-title">🔍 Quick Number Checker</h3>
                    <p>Instantly verify a single phone number without running a full scan.</p>
                    <form className="inv-checker-form" onSubmit={checkSingleNumber}>
                        <input
                            type="text"
                            className="inv-checker-input"
                            placeholder="e.g. 919876543210"
                            value={singlePhone}
                            onChange={(e) => setSinglePhone(e.target.value)}
                            disabled={singleChecking}
                        />
                        <button type="submit" className="inv-btn primary" disabled={singleChecking}>
                            {singleChecking ? 'Checking...' : 'Verify'}
                        </button>
                    </form>
                    {singleResult && (
                        <div className={`inv-single-result ${singleResult.isRegistered ? 'success' : 'error'}`}>
                            {singleResult.isRegistered ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                            <span>
                                {singleResult.error ? singleResult.error : (
                                    <>
                                        <strong>{singleResult.phone}</strong> is {singleResult.isRegistered ? '✓ registered' : '✗ NOT registered'} on WhatsApp.
                                    </>
                                )}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Invalid Numbers Table ── */}
            <section className="inv-section">
                <div className="inv-section-header">
                    <h2 className="inv-section-title">
                        <AlertTriangle size={18} className="icon-danger" />
                        Customers Not on WhatsApp
                        {hasInvalid && <span className="inv-badge danger">{notOnWhatsApp.length}</span>}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {selectedIds.length > 0 && (
                            <button className="inv-btn danger-ghost" onClick={handleBulkDelete}>
                                <Trash2 size={14} /> Delete Selected ({selectedIds.length})
                            </button>
                        )}
                        {hasInvalid && !scanning && (
                            <>
                                <button className="inv-btn ghost" onClick={copyAsCSV}>
                                    <Copy size={14} /> {copied ? 'Copied!' : 'Copy CSV'}
                                </button>
                                <button className="inv-btn ghost" onClick={downloadCSV}>
                                    <Download size={14} /> Export CSV
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {scanned === 0 && !scanning ? (
                    <div className="inv-empty-state">
                        <AlertCircle size={48} className="icon-warning" />
                        <h3>Audit Ready</h3>
                        <p>No scan has been run yet. Start a full scan or verify only unscanned contacts to find numbers not registered on WhatsApp.</p>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <button className="inv-btn primary" onClick={() => runScan(false)}>
                                <Play size={14} /> Run Full Scan
                            </button>
                            {unscannedCount < total && (
                                <button className="inv-btn ghost" onClick={() => runScan(true)}>
                                    Scan Unscanned ({unscannedCount})
                                </button>
                            )}
                        </div>
                    </div>
                ) : !scanning && !hasInvalid ? (
                    <div className="inv-empty-state success">
                        <CheckCircle size={48} />
                        <h3>All Clear!</h3>
                        <p>Excellent — all audited customers have active WhatsApp accounts registered.</p>
                    </div>
                ) : (
                    <div className="inv-table-wrapper">
                        <table className="inv-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px', textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={notOnWhatsApp.length > 0 && selectedIds.length === notOnWhatsApp.length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Phone Number</th>
                                    <th>Email</th>
                                    <th>Added On</th>
                                    <th>Audit Result</th>
                                    <th style={{ textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notOnWhatsApp.map(c => (
                                    <tr key={c.id} className={selectedIds.includes(c.id) ? 'selected' : ''}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(c.id)}
                                                onChange={() => toggleSelect(c.id)}
                                            />
                                        </td>
                                        <td className="inv-id">#{c.id}</td>
                                        <td className="inv-name">{c.name}</td>
                                        <td>
                                            <code className="inv-phone invalid">{c.stored_phone}</code>
                                        </td>
                                        <td className="inv-email">{c.email || <span className="inv-muted">—</span>}</td>
                                        <td className="inv-date">
                                            {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}
                                        </td>
                                        <td>
                                            <span className="inv-error-pill">{c.error || 'Not registered on WhatsApp'}</span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                className="inv-btn danger-ghost"
                                                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                                onClick={() => handleDelete(c.id, c.name)}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {notOnWhatsApp.length === 0 && scanning && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                                            Scanning in progress — non-registered contacts will appear here as they are found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <footer className="inv-footer">
                <p>This audit tool queries the live WhatsApp server via the local Baileys engine to verify customer registration status in real-time.</p>
            </footer>
        </div>
    );
};

export default InvalidNumbers;
