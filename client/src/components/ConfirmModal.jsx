import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import '../styles/ConfirmModal.css';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger', // 'danger' or 'info'
    thirdText = null,
    onThirdConfirm = null,
    thirdType = 'info'
}) => {
    if (!isOpen) return null;

    return (
        <div className="confirm-modal-overlay" onClick={onClose}>
            <div className={`confirm-modal ${type}`} onClick={e => e.stopPropagation()}>
                <button className="confirm-modal-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="confirm-modal-icon">
                    {type === 'danger' ? <AlertTriangle size={32} /> : <Info size={32} />}
                </div>

                <div className="confirm-modal-content">
                    <h3>{title}</h3>
                    <p>{message}</p>
                </div>

                <div className="confirm-modal-actions">
                    {thirdText && onThirdConfirm && (
                        <button className={`confirm-btn confirm third-btn ${thirdType}`} onClick={() => {
                            onThirdConfirm();
                            // NOTE: Do NOT call onClose() here for async actions.
                            // The caller controls the modal via isOpen prop.
                        }}>
                            {thirdText}
                        </button>
                    )}
                    <button className="confirm-btn cancel" onClick={onClose}>
                        {cancelText}
                    </button>
                    <button className={`confirm-btn confirm ${type}`} onClick={() => {
                        onConfirm();
                        onClose();
                    }}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
