# SaleScope POS 🚀

SaleScope POS is a modern, high-performance Point of Sale (POS) and inventory management system designed to streamline retail operations. Built as a powerful desktop application using Electron, React, and Node.js, SaleScope provides lightning-fast checkout experiences, comprehensive inventory control, and seamless customer engagement tools.

## ✨ Features

### 🛒 Point of Sale (Checkout)
- **Lightning-Fast Processing:** Optimized in-memory caching and single-roundtrip API calls for zero-latency bill saving and printing.
- **Barcode Scanner Integration:** Instant product lookup with automatic cart selection and focus shifting.
- **Keyboard Navigation:** Fully keyboard-accessible POS screen (Up/Down arrows, `Ctrl + +`/`Ctrl + -` for quantity adjustments, instant search focus).
- **Customizable UI:** Intuitive interface with zoom controls (`Ctrl + =` / `Ctrl + -`) and adaptable table layouts.

### 📦 Inventory & Product Management
- **Smart Inventory:** Easily add, edit, and manage products with real-time barcode generation.
- **Automatic Focus:** Saving or updating a product instantly filters the inventory list and highlights the updated item with a smooth visual pulse animation.
- **Categorization:** Organize products into categories and subcategories with custom pricing rules.

### 👥 Customer Engagement & CRM
- **WhatsApp Integration:** Built-in WhatsApp Web (wwebjs) integration for sending digital receipts, promotional campaigns, and bulk messages directly to customers.
- **Loyalty Program:** Reward repeat customers with automated loyalty points and redemption.
- **Coupons & Discounts:** Apply percentage or flat-rate discounts and manage promotional coupons.

### 💼 Business Operations
- **Credit Notes & Returns:** Seamlessly handle product returns and issue credit notes.
- **Expense Tracking:** Monitor daily shop expenses and categorize outgoings.
- **Employee Roles & Permissions:** Restrict access based on user roles (Admin, Cashier, Manager).
- **Comprehensive Dashboard & Reports:** Visualize sales metrics, daily summaries, and export reports for accounting.

### 🔒 Security & Reliability
- **Local Database:** Powered by a robust local SQLite database ensuring you can operate even without an active internet connection.
- **Automated Backups:** Integrated Google Drive backup service to keep your business data safe in the cloud.
- **License Validation:** Built-in software licensing and validation system.

---

## 🛠️ Technology Stack

- **Frontend:** React, Vite, Vanilla CSS (Modern, dynamic UI with glassmorphism and micro-animations)
- **Backend:** Node.js, Express.js
- **Database:** SQLite (with automated schema migrations)
- **Desktop Packaging:** Electron, Electron-builder (NSIS Installer)
- **Integrations:** `whatsapp-web.js` for WhatsApp connectivity, Google Drive API for backups

---

## 🚀 Installation

### Using Windows Package Manager (WinGet)
You can install SaleScope directly via WinGet (once published):
```powershell
winget install SaleScopeSoftware.SaleScopePOS
```

### Manual Installation
1. Go to the [Releases](https://github.com/salescope-software/salescope-pos/releases) page.
2. Download the latest `SaleScope Setup X.X.X.exe`.
3. Run the installer and follow the on-screen instructions.

---

## 💻 Development Setup

If you want to run SaleScope locally for development:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/salescope-software/salescope-pos.git
   cd salescope-pos
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Copy `.env.example` to `.env` and fill in your local database credentials and JWT secrets.
   ```bash
   cp .env.example .env
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

5. **Build for Production (Create Installer):**
   ```bash
   npm run dist
   ```

---

## 📄 License

Copyright © 2026 SaleScope Software. All rights reserved.
