CREATE DATABASE IF NOT EXISTS retail_shop_db;
USE retail_shop_db;

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('manager', 'staff') NOT NULL DEFAULT 'staff',
    role_id INT,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    profile_image VARCHAR(255),
    is_system BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    last_login_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);

-- 3. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(100) UNIQUE,
    module VARCHAR(50),
    category VARCHAR(50) NOT NULL,
    description TEXT
);

-- 4. Role_Permissions Table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 5. Employee Permissions (Direct mapping)
CREATE TABLE IF NOT EXISTS employee_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    permission_id INT NOT NULL,
    granted_by INT,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_emp_perm (employee_id, permission_id)
);

-- 6. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT,
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    details LONGTEXT,
    ip_address VARCHAR(45),
    entity_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_activity_logs_created_at (created_at),
    INDEX idx_activity_logs_employee_id (employee_id)
);

-- 7. Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_shifts_user_id (user_id)
);

-- 8. Categories & Subcategories
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subcategories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_subcategories_category_id (category_id)
);

-- 9. Products Table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barcode VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    subcategory_id INT,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
    INDEX idx_products_category (category),
    INDEX idx_products_stock (stock_quantity)
);

-- 10. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255),
    loyalty_points INT DEFAULT 0,
    total_points_redeemed INT DEFAULT 0,
    total_points_earned INT DEFAULT 0,
    credit_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_name VARCHAR(255) NOT NULL,
    status ENUM('PENDING', 'RECEIVED') DEFAULT 'PENDING',
    total_cost DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS po_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    product_id INT,
    product_name VARCHAR(255),
    barcode VARCHAR(50),
    quantity INT NOT NULL,
);

-- 10. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255),
    loyalty_points INT DEFAULT 0,
    total_points_redeemed INT DEFAULT 0,
    total_points_earned INT DEFAULT 0,
    credit_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_name VARCHAR(255) NOT NULL,
    status ENUM('PENDING', 'RECEIVED') DEFAULT 'PENDING',
    total_cost DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS po_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    product_id INT,
    product_name VARCHAR(255),
    barcode VARCHAR(50),
    quantity INT NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_po_items_po_id (po_id)
);

-- 12. Sales & Sale Items
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    user_id INT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    discount_total DECIMAL(10,2) DEFAULT 0.00,
    coupon_code VARCHAR(50),
    coupon_amount DECIMAL(10,2) DEFAULT 0.00,
    loyalty_amount DECIMAL(10,2) DEFAULT 0.00,
    credit_note_amount DECIMAL(10,2) DEFAULT 0.00,
    was_pay_later BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_sales_created_at (created_at),
    INDEX idx_sales_customer_id (customer_id),
    INDEX idx_sales_user_id (user_id)
CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT,
    product_name VARCHAR(255),
    barcode VARCHAR(255),
    quantity INT NOT NULL,
    price_at_sale DECIMAL(10,2) NOT NULL,
    cost_price_at_sale DECIMAL(10,2) DEFAULT 0.00,
    discount DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_sale_items_sale_id (sale_id),
    INDEX idx_sale_items_product_id (product_id)
);

-- 13. Migrations Tracking Table
CREATE TABLE IF NOT EXISTS _migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Sale Payments (Split Support)
CREATE TABLE IF NOT EXISTS sale_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    INDEX idx_sale_payments_sale_id (sale_id)
);

-- 14. Returns & Return Items
CREATE TABLE IF NOT EXISTS returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_sale_id INT,
    customer_id INT,
    user_id INT NULL,
    total_refund_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_sale_id) REFERENCES sales(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_returns_original_sale_id (original_sale_id)
);

CREATE TABLE IF NOT EXISTS return_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_id INT NOT NULL,
    product_id INT,
    product_name VARCHAR(255),
    barcode VARCHAR(50),
    quantity INT NOT NULL,
    refund_price DECIMAL(10,2) NOT NULL,
    reason VARCHAR(255),
    FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    INDEX idx_return_items_return_id (return_id)
);

-- 15. Credit Notes & Usage
CREATE TABLE IF NOT EXISTS credit_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT,
    amount DECIMAL(10,2) NOT NULL,
    balance DECIMAL(10,2) NOT NULL,
    expiry_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    INDEX idx_credit_notes_customer_id (customer_id)
);

CREATE TABLE IF NOT EXISTS credit_note_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    credit_note_id INT NOT NULL,
    sale_id INT NOT NULL,
    amount_used DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id),
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    INDEX idx_credit_note_usage_cn_id (credit_note_id)
);

-- 16. Loyalty System
CREATE TABLE IF NOT EXISTS loyalty_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_name VARCHAR(255) DEFAULT 'Loyalty Program',
    is_active BOOLEAN DEFAULT TRUE,
    earn_type ENUM('fixed', 'percentage') DEFAULT 'fixed',
    earn_rate_amount DECIMAL(10,2) DEFAULT 100.00,
    earn_rate_points INT DEFAULT 1,
    earn_rate_percent DECIMAL(5,2) DEFAULT 0.00,
    redeem_rate_points INT DEFAULT 1,
    redeem_rate_amount DECIMAL(10,2) DEFAULT 1.00,
    min_redeem_points INT DEFAULT 0,
    max_redeem_percent DECIMAL(5,2) DEFAULT 100.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    sale_id INT,
    type ENUM('earned', 'redeemed', 'adjusted') NOT NULL,
    points INT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
    INDEX idx_loyalty_ledger_customer_id (customer_id)
);

CREATE TABLE IF NOT EXISTS loyalty_category_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    subcategory_id INT,
    earn_type ENUM('fixed', 'percentage') DEFAULT 'fixed',
    earn_rate_amount DECIMAL(10,2),
    earn_rate_points INT,
    earn_rate_percent DECIMAL(5,2),
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loyalty_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    card_number VARCHAR(50) UNIQUE NOT NULL,
    status ENUM('active', 'inactive', 'lost') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 17. Coupons System
CREATE TABLE IF NOT EXISTS coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type ENUM('fixed', 'percentage') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0.00,
    max_discount_amount DECIMAL(10,2),
    start_date DATETIME,
    expiry_date DATETIME,
    usage_limit INT,
    usage_count INT DEFAULT 0,
    target_type ENUM('all', 'product', 'category', 'subcategory', 'customer', 'price_range') DEFAULT 'all',
    target_value JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_usages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coupon_id INT NOT NULL,
    sale_id INT NOT NULL,
    customer_id INT,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_coupon_usages_sale_id (sale_id)
);

-- 18. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    reason VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    category VARCHAR(100) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_expenses_date (date)
);

-- 19. Store Settings Table
CREATE TABLE IF NOT EXISTS store_settings (
    id INT NOT NULL DEFAULT 1 PRIMARY KEY,
    store_name VARCHAR(255) NOT NULL DEFAULT 'Salescope',
    address TEXT,
    phone_1 VARCHAR(20),
    phone_2 VARCHAR(20),
    instagram_link VARCHAR(255),
    exchange_policy_text VARCHAR(255) DEFAULT 'Valid for 3 days',
    whatsapp_caption VARCHAR(255) DEFAULT 'Happy shopping',
    logo_url VARCHAR(255),
    logo_width VARCHAR(50),
    logo_height VARCHAR(50),
    bill_logo_url VARCHAR(255),
    bill_logo_width VARCHAR(50),
    bill_logo_height VARCHAR(50),
    login_logo_url VARCHAR(255),
    login_logo_width VARCHAR(50),
    login_logo_height VARCHAR(50),
    pos_background_url VARCHAR(255),
    pos_background_width VARCHAR(50),
    pos_background_height VARCHAR(50),
    pos_background_opacity DECIMAL(3,2) DEFAULT 0.10,
    product_add_sound_url VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
);

-- 20. Triggers & Initial Data
-- ------------------------------------------

DROP TRIGGER IF EXISTS prevent_system_user_delete;
CREATE TRIGGER prevent_system_user_delete
    BEFORE DELETE ON users
    FOR EACH ROW
BEGIN
    IF OLD.is_system = 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete System Account';
    END IF;
END;

-- Initial Seeds
INSERT IGNORE INTO roles (id, name, description, is_system) VALUES (1, 'Super Admin', 'Full system access', 1);
INSERT IGNORE INTO store_settings (id, store_name) VALUES (1, 'Salescope');
INSERT IGNORE INTO loyalty_settings (id) VALUES (1);

-- Permissions Seed
INSERT IGNORE INTO permissions (code, name, module, category, description) VALUES
('pos.access', 'pos.access', 'POS', 'POS', 'Access POS module'),
('pos.cart.add', 'pos.cart.add', 'POS', 'POS', 'Add items to cart'),
('pos.cart.update', 'pos.cart.update', 'POS', 'POS', 'Update cart items'),
('pos.cart.remove', 'pos.cart.remove', 'POS', 'POS', 'Remove items from cart'),
('pos.discount.apply', 'pos.discount.apply', 'POS', 'POS', 'Apply discounts'),
('pos.coupon.apply', 'pos.coupon.apply', 'POS', 'POS', 'Apply coupons'),
('pos.hold_bill', 'pos.hold_bill', 'POS', 'POS', 'Hold bills for later'),
('pos.resume_bill', 'pos.resume_bill', 'POS', 'POS', 'Resume held bills'),
('pos.checkout', 'pos.checkout', 'POS', 'POS', 'Complete checkout'),
('pos.pay_later', 'pos.pay_later', 'POS', 'POS', 'Create pay later transactions'),
('pos.print_bill', 'pos.print_bill', 'POS', 'POS', 'Print bills'),
('pos.whatsapp_bill', 'pos.whatsapp_bill', 'POS', 'POS', 'Send bills via WhatsApp'),
('inventory.view', 'inventory.view', 'Inventory', 'Inventory', 'View inventory'),
('inventory.product.create', 'inventory.product.create', 'Inventory', 'Inventory', 'Create products'),
('inventory.product.update', 'inventory.product.update', 'Inventory', 'Inventory', 'Update products'),
('inventory.product.delete', 'inventory.product.delete', 'Inventory', 'Inventory', 'Delete products'),
('inventory.stock.adjust', 'inventory.stock.adjust', 'Inventory', 'Inventory', 'Adjust stock levels'),
('inventory.import', 'inventory.import', 'Inventory', 'Inventory', 'Import inventory data'),
('inventory.export', 'inventory.export', 'Inventory', 'Inventory', 'Export inventory data'),
('inventory.category.manage', 'inventory.category.manage', 'Inventory', 'Inventory', 'Manage categories'),
('barcode.generate', 'barcode.generate', 'Barcode', 'Barcode', 'Generate barcodes'),
('barcode.print', 'barcode.print', 'Barcode', 'Barcode', 'Print barcodes'),
('barcode.batch_print', 'barcode.batch_print', 'Barcode', 'Barcode', 'Batch print barcodes'),
('customer.view', 'customer.view', 'Customer', 'Customer', 'View customers'),
('customer.create', 'customer.create', 'Customer', 'Customer', 'Create customers'),
('customer.update', 'customer.update', 'Customer', 'Customer', 'Update customers'),
('customer.delete', 'customer.delete', 'Customer', 'Customer', 'Delete customers'),
('customer.import', 'customer.import', 'Customer', 'Customer', 'Import customers'),
('customer.export', 'customer.export', 'Customer', 'Customer', 'Export customers'),
('customer.history.view', 'customer.history.view', 'Customer', 'Customer', 'View customer history'),
('loyalty.view', 'loyalty.view', 'Loyalty', 'Loyalty', 'View loyalty settings'),
('loyalty.settings.update', 'loyalty.settings.update', 'Loyalty', 'Loyalty', 'Update loyalty settings'),
('loyalty.points.adjust', 'loyalty.points.adjust', 'Loyalty', 'Loyalty', 'Adjust customer points'),
('loyalty.rules.manage', 'loyalty.rules.manage', 'Loyalty', 'Loyalty', 'Manage loyalty rules'),
('coupon.view', 'coupon.view', 'Coupon', 'Coupon', 'View coupons'),
('coupon.create', 'coupon.create', 'Coupon', 'Coupon', 'Create coupons'),
('coupon.update', 'coupon.update', 'Coupon', 'Coupon', 'Update coupons'),
('coupon.delete', 'coupon.delete', 'Coupon', 'Coupon', 'Delete coupons'),
('coupon.assign', 'coupon.assign', 'Coupon', 'Coupon', 'Assign coupons to customers'),
('credit_note.view', 'credit_note.view', 'Credit Note', 'Credit Note', 'View credit notes'),
('credit_note.issue', 'credit_note.issue', 'Credit Note', 'Credit Note', 'Issue credit notes'),
('credit_note.apply', 'credit_note.apply', 'Credit Note', 'Credit Note', 'Apply credit notes'),
('credit_note.expiry.manage', 'credit_note.expiry.manage', 'Credit Note', 'Credit Note', 'Manage credit note expiry'),
('credit_bill.view', 'credit_bill.view', 'Credit Bill', 'Credit Bill', 'View credit bills'),
('credit_bill.create', 'credit_bill.create', 'Credit Bill', 'Credit Bill', 'Create credit bills'),
('credit_bill.collect_payment', 'credit_bill.collect_payment', 'Credit Bill', 'Credit Bill', 'Collect payment on credit bills'),
('returns.view', 'returns.view', 'Returns', 'Returns', 'View returns'),
('returns.process', 'returns.process', 'Returns', 'Returns', 'Process returns'),
('exchange.process', 'exchange.process', 'Returns', 'Returns', 'Process exchanges'),
('refund.cash', 'refund.cash', 'Returns', 'Returns', 'Issue cash refunds'),
('refund.credit_note', 'refund.credit_note', 'Returns', 'Returns', 'Issue credit note refunds'),
('sales.view', 'sales.view', 'Sales', 'Sales', 'View sales records'),
('sales.filter', 'sales.filter', 'Sales', 'Sales', 'Filter sales records'),
('sales.export', 'sales.export', 'Sales', 'Sales', 'Export sales data'),
('sales.bill.view', 'sales.bill.view', 'Sales', 'Sales', 'View bill details'),
('expense.view', 'expense.view', 'Expense', 'Expense', 'View expenses'),
('expense.create', 'expense.create', 'Expense', 'Expense', 'Create expenses'),
('expense.update', 'expense.update', 'Expense', 'Expense', 'Update expenses'),
('expense.delete', 'expense.delete', 'Expense', 'Expense', 'Delete expenses'),
('expense.report.view', 'expense.report.view', 'Expense', 'Expense', 'View expense reports'),
('purchase_order.view', 'purchase_order.view', 'Purchase Order', 'Purchase Order', 'View purchase orders'),
('purchase_order.create', 'purchase_order.create', 'Purchase Order', 'Purchase Order', 'Create purchase orders'),
('purchase_order.receive', 'purchase_order.receive', 'Purchase Order', 'Purchase Order', 'Receive purchase orders'),
('backup.view', 'backup.view', 'Backup', 'Backup', 'View backups'),
('backup.create', 'backup.create', 'Backup', 'Backup', 'Create backups'),
('backup.restore', 'backup.restore', 'Backup', 'Backup', 'Restore from backup'),
('backup.delete', 'backup.delete', 'Backup', 'Backup', 'Delete backups'),
('backup.drive.sync', 'backup.drive.sync', 'Backup', 'Backup', 'Sync with Google Drive'),
('database.reset', 'database.reset', 'Backup', 'Backup', 'Reset database (danger zone)'),
('whatsapp.connect', 'whatsapp.connect', 'WhatsApp', 'WhatsApp', 'Connect WhatsApp'),
('whatsapp.disconnect', 'whatsapp.disconnect', 'WhatsApp', 'WhatsApp', 'Disconnect WhatsApp'),
('whatsapp.send_bill', 'whatsapp.send_bill', 'WhatsApp', 'WhatsApp', 'Send bills via WhatsApp'),
('whatsapp.bulk_message', 'whatsapp.bulk_message', 'WhatsApp', 'WhatsApp', 'Send bulk messages'),
('whatsapp.view_logs', 'whatsapp.view_logs', 'WhatsApp', 'WhatsApp', 'View WhatsApp logs'),
('dashboard.view', 'dashboard.view', 'Reports', 'Reports', 'View dashboard'),
('reports.view', 'reports.view', 'Reports', 'Reports', 'View reports'),
('reports.export', 'reports.export', 'Reports', 'Reports', 'Export reports'),
('profit_analysis.view', 'profit_analysis.view', 'Reports', 'Reports', 'View profit analysis'),
('employee.view', 'employee.view', 'Employee', 'Employee', 'View employees'),
('employee.create', 'employee.create', 'Employee', 'Employee', 'Create employees'),
('employee.update', 'employee.update', 'Employee', 'Employee', 'Update employees'),
('employee.delete', 'employee.delete', 'Employee', 'Employee', 'Delete employees'),
('employee.disable', 'employee.disable', 'Employee', 'Employee', 'Disable employees'),
('permission.assign', 'permission.assign', 'Employee', 'Employee', 'Assign permissions'),
('activity_log.view', 'activity_log.view', 'Employee', 'Employee', 'View activity logs');

-- Default Super Admin (Password: admin123)
INSERT IGNORE INTO users (name, username, password_hash, role_id, is_system, is_admin, status) 
VALUES ('Super Admin', 'admin', '$2b$10$hkGTrmID0dV4LkAEN52U7u2DFArATzy.b5wTFrgph/U1a1YE549Eu', 1, 1, 1, 'active');

-- Grant all permissions to the admin user
INSERT IGNORE INTO employee_permissions (employee_id, permission_id, granted_by)
SELECT 
    (SELECT id FROM users WHERE username = 'admin'), 
    id, 
    (SELECT id FROM users WHERE username = 'admin')
FROM permissions;

-- ------------------------------------------
-- Barcode Studio & Printer Tables
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS barcode_presets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Product Barcode',
    is_default TINYINT(1) DEFAULT 0,
    is_favorite TINYINT(1) DEFAULT 0,
    label_width DECIMAL(6,2) NOT NULL DEFAULT 50.00,
    label_height DECIMAL(6,2) NOT NULL DEFAULT 25.00,
    paper_type VARCHAR(50) DEFAULT 'thermal',
    page_layout JSON,
    canvas_data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS printer_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    printer_type VARCHAR(50) DEFAULT 'thermal',
    dpi INT DEFAULT 203,
    print_mode VARCHAR(50) DEFAULT 'gap',
    darkness INT DEFAULT 10,
    speed INT DEFAULT 3,
    offset_x DECIMAL(5,2) DEFAULT 0.00,
    offset_y DECIMAL(5,2) DEFAULT 0.00,
    feed_direction VARCHAR(50) DEFAULT 'normal',
    page_size VARCHAR(50) DEFAULT 'Custom',
    is_default TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------
-- End of Schema
