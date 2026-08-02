import React from 'react';
import { createPortal } from 'react-dom';
import { X, Keyboard, Command } from 'lucide-react';
import '../styles/Modal.css';

const ShortcutModal = ({ onClose }) => {
    // Shortcuts Data
    const shortcuts = [
        {
            category: "Point of Sale (POS)",
            items: [
                { key: "F1", description: "Start New Bill / Reset" },
                { key: "Ctrl + S", description: "Save Bill (No Print)" },
                { key: "Ctrl + Enter", description: "Save & Print Bill" },
                { key: "Alt + C", description: "Focus Customer Search" },
                { key: "Alt + D", description: "Focus Global Discount" },
                { key: "` or ~", description: "Toggle Payment Modes" },
                { key: "F6", description: "Checkout with Cash" },
                { key: "F7", description: "Checkout with UPI" },
                { key: "F8", description: "Checkout with Card" },
                { key: "Arrow Up / Down", description: "Navigate Cart Items" },
                { key: "+ or -", description: "Adjust highlighted item Qty" },
                { key: "Ctrl + + / -", description: "Adjust last added item Qty" },
                { key: "Delete", description: "Remove highlighted item" },
                { key: "Esc", description: "Reset Search / Close Modals" }
            ]
        },
        {
            category: "Universal / Global Shortcuts",
            items: [
                { key: "F1", description: "Launch POS / New Bill" },
                { key: "F5", description: "Reload / Refresh App" },
                { key: "Alt + Q", description: "Open WhatsApp QR" },
                { key: "Alt + W", description: "Go to Sales Records" },
                { key: "Alt + E", description: "Go to Inventory" },
                { key: "Alt + R", description: "Go to Customers" }
            ]
        },
        {
            category: "General",
            items: [
                { key: "Esc", description: "Close Modals / Popups" }
            ]
        }
    ];

    return createPortal(
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content shortcut-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="header-icon-wrapper">
                            <Keyboard size={22} />
                        </div>
                        <div>
                            <h2>Keyboard Shortcuts</h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>Master the app with these quick commands</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body custom-scrollbar">
                    <div className="shortcuts-container">
                        {shortcuts.map((section, idx) => (
                            <div key={idx} className="shortcut-section">
                                <h3 className="shortcut-category-title">
                                    {section.category === "Point of Sale (POS)" && <Command size={16} />}
                                    {section.category === "Universal / Global Shortcuts" && <Keyboard size={16} />}
                                    {section.category === "General" && <Command size={16} />}
                                    {section.category}
                                </h3>
                                <div className="shortcut-grid">
                                    {section.items.map((item, i) => (
                                        <div key={i} className="shortcut-item">
                                            <div className="keys-wrapper">
                                                {item.key.split(' + ').map((k, kIdx) => (
                                                    <React.Fragment key={kIdx}>
                                                        {kIdx > 0 && <span className="key-separator">+</span>}
                                                        <kbd className="shortcut-key">{k}</kbd>
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <span className="shortcut-desc">{item.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <style>{`
                .shortcut-modal {
                    max-width: 650px;
                    width: 95%;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    border-radius: 1rem;
                    overflow: hidden;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                }
                .header-icon-wrapper {
                    padding: 8px;
                    background: rgba(var(--primary-rgb, 99, 102, 241), 0.15);
                    color: var(--primary);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .shortcuts-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .shortcut-category-title {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--primary);
                    margin-bottom: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px dashed var(--border);
                }
                .shortcut-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 0.75rem 1.5rem;
                }
                .shortcut-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.5rem 0.75rem;
                    border-radius: 8px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    transition: all 0.2s;
                }
                .shortcut-item:hover {
                    background: var(--bg-sub);
                    border-color: var(--primary);
                }
                .keys-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .key-separator {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }
                .shortcut-key {
                    background: var(--bg-sub);
                    border: 1px solid var(--border);
                    border-bottom-width: 2px;
                    border-radius: 6px;
                    padding: 2px 8px;
                    font-family: 'Inter', sans-serif;
                    font-weight: 700;
                    font-size: 0.8rem;
                    color: var(--text-main);
                    min-width: 24px;
                    text-align: center;
                    display: inline-block;
                    line-height: 1.4;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .shortcut-desc {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    font-weight: 500;
                }
            `}</style>
        </div>,
        document.body
    );
};

export default ShortcutModal;
