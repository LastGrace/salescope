import React from 'react';
import { Routes, Route, Navigate, BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ConfirmModal from './components/ConfirmModal';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy-loaded pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Statistics from './pages/Statistics';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import POSNew from './pages/POSNew';
import SalesRecords from './pages/SalesRecords';
import Customers from './pages/Customers';
import PurchaseOrders from './pages/PurchaseOrders';
import BarcodeGenerator from './pages/BarcodeGenerator';
import QuickAddProduct from './pages/QuickAddProduct';
import CreditBills from './pages/CreditBills';
import LoyaltySettings from './pages/LoyaltySettings';
import ReturnExchange from './pages/ReturnExchange';
import CreditNotes from './pages/CreditNotes';
import CategoryManager from './pages/CategoryManager';
import CouponManager from './pages/CouponManager';
import ExpenseManager from './pages/ExpenseManager';
import WhatsAppBulk from './pages/WhatsAppBulk';
import DatabaseManager from './pages/DatabaseManager';
import EmployeeList from './pages/Employees/EmployeeList';
import EmployeeForm from './pages/Employees/EmployeeForm';
import EmployeePermissions from './pages/Employees/EmployeePermissions';
import FileManager from './pages/FileManager';
import StoreSettings from './pages/StoreSettings';
import ConnectDrive from './pages/ConnectDrive';
import Activation from './pages/Activation';

const PrivateRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const App = () => {
  const { token } = useAuth(); // Safely grab token from context instead of localStorage
  const navigate = useNavigate();
  const location = useLocation();

  const [licenseStatus, setLicenseStatus] = React.useState({ status: 'checking', reason: '' });

  const checkLicense = React.useCallback(async () => {
    try {
      const res = await fetch('/api/license/status');
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(data);
      } else {
        setLicenseStatus({ status: 'invalid', reason: 'License manager unreachable.' });
      }
    } catch (err) {
      setLicenseStatus({ status: 'invalid', reason: 'Failed to communicate with local license manager.' });
    }
  }, []);

  React.useEffect(() => {
    checkLicense();
  }, [checkLicense]);

  // Global handler to prevent scroll wheel from changing number input values
  React.useEffect(() => {
    const handleWheel = (e) => {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  const [exitModal, setExitModal] = React.useState(false);
  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [backupStatusText, setBackupStatusText] = React.useState('Uploading Backup...');

  React.useEffect(() => {
    // Listen for close request from Electron via preload bridge
    if (window.electronAPI) {
      window.electronAPI.onCloseRequest(() => {
        setExitModal(true);
      });
    }
  }, []);

  const handleFinalExit = () => {
    if (window.electronAPI) {
      window.electronAPI.quitApp();
    }
  };

  const handleBackupAndExit = async () => {
    setExitModal(false);  // close the confirm modal first
    setIsBackingUp(true);
    setBackupStatusText('Uploading Backup & Sending Report...');
    let log = [];
    try {
      // 1. Prepare Data Concurrently
      // We now use the exact auth token from memory (useAuth) rather than local storage.
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');

      const targetDate = todayStr;

      const cacheBust = Date.now();

      const [settingsRes, statsRes] = await Promise.all([
        fetch(`/api/settings/store?_t=${cacheBust}`, { cache: 'no-store' }),
        fetch(`/api/sales/stats?startDate=${targetDate}&endDate=${targetDate}&_t=${cacheBust}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        })
      ]);

      let settings = {};
      let stats = {};
      try {
        if (settingsRes.ok) settings = await settingsRes.json();
        if (statsRes.ok) stats = await statsRes.json();
      } catch (err) {
        console.warn('API JSON parsing error during exit:', err);
      }

      const ownerPhone = settings?.phone_1;

      // 2. Define Parallel Tasks
      const tasks = [];

      // Task A: WhatsApp Report (with retry once)
      tasks.push((async () => {
        if (!statsRes.ok) return `⚠️ WhatsApp Skipped: API Error (${statsRes.status})`;
        if (!ownerPhone) return '⚠️ WhatsApp Skipped: No phone number configured in settings';
        if (!stats || !stats.byMethod || Object.keys(stats.byMethod).length === 0) {
          return `⚠️ WhatsApp Skipped: No sales data found for shift ending ${todayStr}.`;
        }

        const waStatusRes = await fetch('/api/whatsapp/status');
        const waStatus = await waStatusRes.json();
        if (waStatus.status !== 'connected') {
          throw new Error('WhatsApp service not connected.');
        }

        const timeStr = new Date().toLocaleTimeString();
        const totalSale = stats.totalSale || 0;
        const totalProfit = stats.totalProfit || 0;
        const marginPercentage = stats.marginPercentage || 0;
        const paymentDetails = Object.entries(stats.byMethod)
          .map(([method, data]) => `${method.toUpperCase()}: ₹${(data.amount || 0).toFixed(2)} (${data.count || 0} bills)`)
          .join('\n');
        const totalBills = stats.totalBills !== undefined ? stats.totalBills : Object.values(stats.byMethod).reduce((acc, curr) => Math.max(acc, curr.count || 0), 0);

        const message = `*${todayStr}*\nTime: ${timeStr}\n\n` +
          `💰 *Total Sale:* ₹${totalSale.toFixed(2)}\n` +
          `📈 *Total Margin:* ₹${totalProfit.toFixed(2)} (${marginPercentage}%)\n` +
          `🧾 *Total Bills:* ${totalBills}\n\n` +
          `💳 *Payment Breakdown:*\n${paymentDetails}\n`;

        const sendMessage = async () => {
          const waSendRes = await fetch('/api/whatsapp/sendText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: ownerPhone, message })
          });
          if (!waSendRes.ok) throw new Error('WhatsApp API call failed');
          return await waSendRes.json(); // { success, delivered, msgId }
        };

        // WhatsApp reporting
        let result = await sendMessage();
        console.log('[WA EOD] Send result:', result);

        if (result.delivered) {
          return '✅ WhatsApp Report Delivered';
        } else {
          return '⚠️ WhatsApp Report Sent (Delivery unconfirmed)';
        }
      })());

      // Task B: Cloud Backup
      tasks.push((async () => {
        const response = await fetch('/api/backup/upload-latest', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Cloud backup failed');
        return '✅ Database Backup Uploaded';
      })());

      // 3. Execute Concurrently
      const results = await Promise.allSettled(tasks);
      const failures = results.filter(r => r.status === 'rejected');
      const successes = results.filter(r => r.status === 'fulfilled');

      successes.forEach(s => log.push(s.value));
      failures.forEach(f => log.push(`❌ ${f.reason.message || f.reason}`));

      // 4. Conditional Exit
      if (failures.length === 0) {
        const waStatus = successes.find(s => s.value && s.value.includes('WhatsApp'));
        if (waStatus && waStatus.value.includes('Skipped')) {
          setBackupStatusText(`${waStatus.value}. Closing...`);
        } else if (waStatus && waStatus.value.includes('unconfirmed')) {
          setBackupStatusText('WhatsApp Delivery unconfirmed. Closing...');
        } else if (waStatus) {
          setBackupStatusText('Success! WhatsApp message delivered. Closing...');
        } else {
          setBackupStatusText('All done! Closing...');
        }

        // Wait 2.5 seconds so the user can read the final confirmation
        await new Promise(resolve => setTimeout(resolve, 2500));
        handleFinalExit();
      } else {
        setIsBackingUp(false);
        setBackupStatusText('Uploading Backup...'); // reset
        alert(`Exit Sequence Incomplete!\n\n${log.join('\n')}\n\nPlease fix the errors to exit safely.`);
      }
    } catch (err) {
      console.error('[Exit Flow Error]', err);
      alert(`Critical System Error during exit:\n${err.message}`);
      setIsBackingUp(false);
      setBackupStatusText('Uploading Backup...'); // reset
    }
  };

  const SuspenseFallback = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f8fafc', flexDirection: 'column', gap: '1rem', fontFamily: 'sans-serif' }}>
      <span className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #334155', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Auto-redirect to activation page and poll when license is pending
  React.useEffect(() => {
    if (licenseStatus.status === 'pending') {
      if (location.pathname !== '/activation') {
        navigate('/activation');
      }
    }
  }, [licenseStatus.status, location.pathname, navigate]);

  // Poll license status every 10 seconds while pending (App-level, in case user is not on /activation)
  React.useEffect(() => {
    if (licenseStatus.status !== 'pending') return;
    const interval = setInterval(() => {
      checkLicense();
    }, 10000);
    return () => clearInterval(interval);
  }, [licenseStatus.status, checkLicense]);

  if (licenseStatus.status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f8fafc', flexDirection: 'column', gap: '1rem', fontFamily: 'sans-serif' }}>
        <h3>Loading SaleScope Security...</h3>
        <span className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #334155', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isInactive = licenseStatus.status !== 'licensed';
  const showOverlay = isInactive && licenseStatus.status !== 'pending' && location.pathname !== '/login' && location.pathname !== '/activation';

  return (
    <>
      {showOverlay && (
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#64748b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 99999,
          userSelect: 'none'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontWeight: 500, fontSize: '1.6rem', marginBottom: '0.5rem', color: '#94a3b8', letterSpacing: '-0.025em' }}>Not Active</h2>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569' }}>Contact Administrator for more info.</p>
          </div>
          
          <button 
            onClick={() => navigate('/activation')}
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              background: 'transparent',
              border: 'none',
              color: '#1e293b', // Blended dark grey/blue on the dark background
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              opacity: 0.5,
              transition: 'opacity 0.2s, color 0.2s',
              padding: '10px',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.target.style.opacity = 1;
              e.target.style.color = '#475569';
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = 0.5;
              e.target.style.color = '#1e293b';
            }}
            title="System Info"
          >
            !
          </button>
        </div>
      )}
      <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="activation" element={<Activation licenseStatus={licenseStatus} onActivated={checkLicense} />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="sales-records" element={<SalesRecords />} />
            <Route path="pos" element={<POS />} />
            <Route path="pos-new" element={<POSNew />} />
            <Route path="exchange" element={<ReturnExchange />} />
            <Route path="customers" element={<Customers />} />
            <Route path="orders" element={<PurchaseOrders />} />
            <Route path="credit-bills" element={<CreditBills />} />
            <Route path="credit-notes" element={<CreditNotes />} />
            <Route path="barcodes" element={<BarcodeGenerator />} />

            <Route path="quick-add" element={<QuickAddProduct />} />
            <Route path="loyalty-settings" element={<LoyaltySettings />} />
            <Route path="categories" element={<CategoryManager />} />
            <Route path="coupons" element={<CouponManager />} />
            <Route path="expenses" element={<ExpenseManager />} />
            <Route path="whatsapp-bulk" element={<WhatsAppBulk />} />
            <Route path="database" element={<DatabaseManager />} />
            <Route path="connect-drive" element={<ConnectDrive />} />
            <Route path="settings/store" element={<StoreSettings />} />

            {/* Employee Management */}
            <Route path="employees" element={
              <ProtectedRoute requiredPermission="employee.view"><EmployeeList /></ProtectedRoute>
            } />
            <Route path="employees/new" element={
              <ProtectedRoute requiredPermission="employee.create"><EmployeeForm /></ProtectedRoute>
            } />
            <Route path="employees/edit/:id" element={
              <ProtectedRoute requiredPermission="employee.update"><EmployeeForm /></ProtectedRoute>
            } />
            <Route path="employees/:id/permissions" element={
              <ProtectedRoute requiredPermission="permission.assign"><EmployeePermissions /></ProtectedRoute>
            } />
            <Route path="files" element={
              <ProtectedRoute requiredPermission="files.view"><FileManager /></ProtectedRoute>
            } />
          </Route>
        </Routes>

      <ConfirmModal
        isOpen={exitModal && !isBackingUp}
        onClose={() => setExitModal(false)}
        onConfirm={handleFinalExit}
        title="Exit Salescope"
        message="Would you like to securely upload a backup of your data to Google Drive before closing?"
        confirmText="Exit without Backup"
        cancelText="Cancel"
        type="danger"
        thirdText="Upload & Exit"
        thirdType="info"
        onThirdConfirm={handleBackupAndExit}
      />

      {isBackingUp && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal info spinner-modal">
            <div className="confirm-modal-content">
              <h3>{backupStatusText}</h3>
              <p>Please do not close the software. It will exit automatically when finished.</p>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                <span className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
              </div>
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
    </>
  );
};



import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';

const AppWrapper = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <App />
          <Toaster position="bottom-center" toastOptions={{ duration: 5000 }} />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter >
);

export default AppWrapper;
