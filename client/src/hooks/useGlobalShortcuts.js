import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const useGlobalShortcuts = ({ onOpenWhatsAppQR } = {}) => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (event) => {
            // F1: Launch New POS Page
            if (event.key === 'F1') {
                event.preventDefault();
                navigate('/pos-new');
            }

            // Alt + Q: Launch WhatsApp QR
            if (event.altKey && (event.key === 'q' || event.key === 'Q')) {
                event.preventDefault();
                if (onOpenWhatsAppQR) {
                    onOpenWhatsAppQR();
                }
            }

            // Alt + W: Launch Sales Records
            if (event.altKey && (event.key === 'w' || event.key === 'W')) {
                event.preventDefault();
                navigate('/sales-records');
            }

            // Alt + E: Launch Inventory Page
            if (event.altKey && (event.key === 'e' || event.key === 'E')) {
                event.preventDefault();
                navigate('/inventory');
            }

            // Alt + R: Launch Customers Page
            if (event.altKey && (event.key === 'r' || event.key === 'R')) {
                event.preventDefault();
                navigate('/customers');
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [navigate, onOpenWhatsAppQR]);
};

export default useGlobalShortcuts;
