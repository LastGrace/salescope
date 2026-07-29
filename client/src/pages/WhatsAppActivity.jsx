import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    History, RefreshCcw, Search, Smartphone, Users, CheckCircle, AlertTriangle, 
    Clock, MessageSquare, FileText, ChevronRight, X, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import '../styles/WhatsAppActivity.css';

const WhatsAppActivity = () => {
    const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'campaigns'
    const [directLogs, setDirectLogs] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'sent' | 'failed'
    
    // Modal states
    const [selectedMsg, setSelectedMsg] = useState(null);
    const [selectedCampaign, setSelectedCampaign] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logsRes, campsRes] = await Promise.all([
                axios.get('/api/whatsapp/logs'),
                axios.get('/api/whatsapp/campaigns/history')
            ]);
            
            if (logsRes.data.success) {
                setDirectLogs(logsRes.data.logs);
            }
            if (campsRes.data.success) {
                setCampaigns(campsRes.data.campaigns);
            }
        } catch (err) {
            console.error('Failed to fetch WhatsApp activity logs:', err);
            toast.error('Failed to load WhatsApp activity logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Poll every 8 seconds for active updates (e.g. running campaign updates)
        const timer = setInterval(fetchData, 8000);
        return () => clearInterval(timer);
    }, []);

    // Filter direct messages logs
    const filteredDirectLogs = directLogs.filter(log => {
        const matchesSearch = 
            log.recipient_phone.includes(searchTerm) || 
            (log.recipient_name && log.recipient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (log.message_text && log.message_text.toLowerCase().includes(searchTerm.toLowerCase()));
        
        if (statusFilter === 'all') return matchesSearch;
        return matchesSearch && log.status === statusFilter;
    });

    // Calculate metrics
    const totalSent = directLogs.filter(l => l.status === 'sent').length;
    const totalFailed = directLogs.filter(l => l.status === 'failed').length;
    const successRate = directLogs.length > 0 ? Math.round((totalSent / directLogs.length) * 100) : 100;

    return (
        <div className="wa-activity-container">
            {/* Header */}
            <header className="wa-activity-header">
                <div className="wa-header-left">
                    <div className="wa-header-icon-container">
                        <History size={24} />
                    </div>
                    <div>
                        <h1>WhatsApp Activity Log</h1>
                        <p>Track all direct messages, bills, and bulk campaigns sent from this device</p>
                    </div>
                </div>
                <button className="btn-refresh" onClick={fetchData} disabled={loading}>
                    <RefreshCcw size={16} className={loading ? 'spin-animation' : ''} />
                    <span>Refresh</span>
                </button>
            </header>

            {/* Metrics cards */}
            <div className="wa-metrics-grid">
                <div className="wa-metric-card success">
                    <div className="wa-metric-icon"><CheckCircle size={22} /></div>
                    <div className="wa-metric-data">
                        <h3>{totalSent}</h3>
                        <p>Delivered Messages</p>
                    </div>
                </div>
                <div className="wa-metric-card danger">
                    <div className="wa-metric-icon"><AlertTriangle size={22} /></div>
                    <div className="wa-metric-data">
                        <h3>{totalFailed}</h3>
                        <p>Failed Messages</p>
                    </div>
                </div>
                <div className="wa-metric-card info">
                    <div className="wa-metric-icon"><MessageSquare size={22} /></div>
                    <div className="wa-metric-data">
                        <h3>{successRate}%</h3>
                        <p>Delivery Success Rate</p>
                    </div>
                </div>
                <div className="wa-metric-card total">
                    <div className="wa-metric-icon"><Smartphone size={22} /></div>
                    <div className="wa-metric-data">
                        <h3>{campaigns.length}</h3>
                        <p>Bulk Campaigns Run</p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs and Filters */}
            <div className="wa-controls-row">
                <div className="wa-tabs">
                    <button 
                        className={`wa-tab-btn ${activeTab === 'direct' ? 'active' : ''}`}
                        onClick={() => setActiveTab('direct')}
                    >
                        Direct Messages & Bills
                    </button>
                    <button 
                        className={`wa-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                        onClick={() => setActiveTab('campaigns')}
                    >
                        Bulk Campaigns
                    </button>
                </div>

                {activeTab === 'direct' && (
                    <div className="wa-filters">
                        <div className="wa-search-box">
                            <Search size={16} />
                            <input 
                                type="text" 
                                placeholder="Search by name, phone or text..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="wa-filter-select"
                        >
                            <option value="all">All Statuses</option>
                            <option value="sent">Sent</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Content area */}
            <div className="wa-content-card">
                {loading && directLogs.length === 0 ? (
                    <div className="wa-loading-state">
                        <div className="wa-loading-spinner"></div>
                        <p>Loading transaction logs...</p>
                    </div>
                ) : activeTab === 'direct' ? (
                    filteredDirectLogs.length === 0 ? (
                        <div className="wa-empty-state">
                            <Info size={40} />
                            <h3>No Messages Found</h3>
                            <p>No logged messages found matching your criteria</p>
                        </div>
                    ) : (
                        <div className="wa-table-responsive">
                            <table className="wa-activity-table">
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Recipient</th>
                                        <th>Phone</th>
                                        <th>Type</th>
                                        <th>Attachment</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDirectLogs.map((log) => (
                                        <tr key={log.id} className={log.status === 'failed' ? 'row-failed' : ''}>
                                            <td className="time-col">
                                                {new Date(log.created_at).toLocaleString('en-IN', {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short'
                                                })}
                                            </td>
                                            <td className="name-col">{log.recipient_name}</td>
                                            <td className="phone-col">+{log.recipient_phone}</td>
                                            <td>
                                                <span className={`wa-badge type ${log.message_type}`}>
                                                    {log.message_type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="file-col">
                                                {log.media_filename ? (
                                                    <span className="file-text" title={log.media_filename}>
                                                        <FileText size={14} style={{ marginRight: '4px' }} />
                                                        {log.media_filename.length > 20 ? log.media_filename.slice(0, 17) + '...' : log.media_filename}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td>
                                                <span className={`wa-badge status ${log.status}`}>
                                                    {log.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <button 
                                                    className="btn-action-view" 
                                                    onClick={() => setSelectedMsg(log)}
                                                    title="View Details"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    campaigns.length === 0 ? (
                        <div className="wa-empty-state">
                            <Info size={40} />
                            <h3>No Campaigns Found</h3>
                            <p>Bulk campaigns started on the device will appear here</p>
                        </div>
                    ) : (
                        <div className="wa-campaigns-list">
                            {campaigns.map((camp) => (
                                <div key={camp.id} className={`wa-camp-card ${camp.running ? 'running' : ''}`}>
                                    <div className="wa-camp-card-header">
                                        <div className="wa-camp-title-row">
                                            <span className="wa-camp-id">{camp.id}</span>
                                            <span className={`wa-badge status ${camp.running ? 'running' : camp.cancelled ? 'cancelled' : 'completed'}`}>
                                                {camp.running ? 'RUNNING' : camp.cancelled ? 'CANCELLED' : 'COMPLETED'}
                                            </span>
                                        </div>
                                        <span className="wa-camp-time">
                                            Started: {new Date(camp.started_at).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                    <div className="wa-camp-body">
                                        <div className="wa-camp-stats">
                                            <div className="wa-camp-stat-item">
                                                <span className="stat-label">Total Recipients</span>
                                                <span className="stat-value">{camp.total}</span>
                                            </div>
                                            <div className="wa-camp-stat-item">
                                                <span className="stat-label">Sent</span>
                                                <span className="stat-value success">{camp.sent}</span>
                                            </div>
                                            <div className="wa-camp-stat-item">
                                                <span className="stat-label">Failed / Skipped</span>
                                                <span className="stat-value danger">{camp.failed}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="wa-camp-message-preview">
                                            <strong>Message Content:</strong>
                                            <p className="preview-text">{camp.message || '(Media Attachment Only)'}</p>
                                            {camp.file_name && (
                                                <div className="media-attachment-badge">
                                                    <FileText size={14} />
                                                    <span>{camp.file_name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="wa-camp-footer">
                                        <button 
                                            className="btn-camp-details" 
                                            onClick={() => setSelectedCampaign(camp)}
                                        >
                                            View Logs & Audience ({camp.logs.length} entries) <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Direct message details Modal */}
            {selectedMsg && (
                <div className="wa-modal-overlay" onClick={() => setSelectedMsg(null)}>
                    <div className="wa-modal-content" onClick={(e) => e.stopPropagation()}>
                        <header className="wa-modal-header">
                            <h3>Message Details</h3>
                            <button className="btn-close" onClick={() => setSelectedMsg(null)}><X size={18} /></button>
                        </header>
                        <div className="wa-modal-body">
                            <div className="wa-detail-field">
                                <span className="detail-label">Recipient</span>
                                <span className="detail-value">{selectedMsg.recipient_name} (+{selectedMsg.recipient_phone})</span>
                            </div>
                            <div className="wa-detail-field">
                                <span className="detail-label">Timestamp</span>
                                <span className="detail-value">{new Date(selectedMsg.created_at).toLocaleString()}</span>
                            </div>
                            <div className="wa-detail-field">
                                <span className="detail-label">Status</span>
                                <span className={`wa-badge status ${selectedMsg.status}`}>
                                    {selectedMsg.status.toUpperCase()}
                                </span>
                            </div>
                            
                            {selectedMsg.status === 'failed' && (
                                <div className="wa-detail-field error-container">
                                    <span className="detail-label error-label">Error Reason</span>
                                    <span className="detail-value error-value">
                                        <AlertTriangle size={15} style={{ marginRight: '6px' }} />
                                        {selectedMsg.error_message || 'Unknown network or registration error'}
                                    </span>
                                </div>
                            )}

                            <div className="wa-detail-field msg-content">
                                <span className="detail-label">Message Payload</span>
                                <div className="detail-message-box">
                                    {selectedMsg.message_text}
                                </div>
                            </div>

                            {selectedMsg.media_filename && (
                                <div className="wa-detail-field">
                                    <span className="detail-label">Attachment filename</span>
                                    <div className="media-attachment-badge">
                                        <FileText size={14} />
                                        <span>{selectedMsg.media_filename}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <footer className="wa-modal-footer">
                            <button className="btn-modal-primary" onClick={() => setSelectedMsg(null)}>Close</button>
                        </footer>
                    </div>
                </div>
            )}

            {/* Campaign details Modal */}
            {selectedCampaign && (
                <div className="wa-modal-overlay" onClick={() => setSelectedCampaign(null)}>
                    <div className="wa-modal-content large" onClick={(e) => e.stopPropagation()}>
                        <header className="wa-modal-header">
                            <div>
                                <h3>Campaign: {selectedCampaign.id}</h3>
                                <span className="campaign-subheading">
                                    Started: {new Date(selectedCampaign.started_at).toLocaleString()}
                                </span>
                            </div>
                            <button className="btn-close" onClick={() => setSelectedCampaign(null)}><X size={18} /></button>
                        </header>
                        <div className="wa-modal-body flex-modal-body">
                            <div className="modal-left-panel">
                                <div className="wa-detail-field">
                                    <span className="detail-label">Status</span>
                                    <span className={`wa-badge status ${selectedCampaign.running ? 'running' : selectedCampaign.cancelled ? 'cancelled' : 'completed'}`}>
                                        {selectedCampaign.running ? 'RUNNING' : selectedCampaign.cancelled ? 'CANCELLED' : 'COMPLETED'}
                                    </span>
                                </div>
                                <div className="wa-detail-field">
                                    <span className="detail-label">Delivery Progress</span>
                                    <div className="progress-bar-container">
                                        <div className="progress-fill" style={{ width: `${Math.round((selectedCampaign.sent + selectedCampaign.failed) / selectedCampaign.total * 100)}%` }}></div>
                                    </div>
                                    <span className="progress-text">
                                        Processed {selectedCampaign.sent + selectedCampaign.failed} / {selectedCampaign.total} ({selectedCampaign.sent} sent, {selectedCampaign.failed} failed)
                                    </span>
                                </div>
                                
                                <div className="wa-detail-field msg-content">
                                    <span className="detail-label">Campaign Message</span>
                                    <div className="detail-message-box">
                                        {selectedCampaign.message || '(Media Only)'}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="modal-right-panel">
                                <span className="detail-label">Execution Logs & Trace</span>
                                <div className="campaign-logs-box">
                                    {selectedCampaign.logs.length === 0 ? (
                                        <p className="no-logs">No execution logs logged for this campaign</p>
                                    ) : (
                                        selectedCampaign.logs.map((log, index) => (
                                            <div key={index} className={`log-entry ${log.type}`}>
                                                <span className="log-time">[{log.time}]</span>
                                                <span className="log-msg">{log.msg}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        <footer className="wa-modal-footer">
                            <button className="btn-modal-primary" onClick={() => setSelectedCampaign(null)}>Close Details</button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppActivity;