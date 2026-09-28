-- ============================================================
-- Inventory & Delivery Management System
-- Schema + Seed Data
-- Default login password for ALL seed users: password123
-- ============================================================

CREATE DATABASE IF NOT EXISTS inventory_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventory_db;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id        INT           NOT NULL AUTO_INCREMENT,
    full_name      VARCHAR(100)  NOT NULL,
    email          VARCHAR(100)  NOT NULL,
    password       VARCHAR(255)  NOT NULL,
    phone          VARCHAR(15)   NOT NULL,
    account_status VARCHAR(20)   NOT NULL DEFAULT 'Active',
    vehicle_type   VARCHAR(50)   NULL,          -- Only for @delpart.com users
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    product_id         INT            NOT NULL AUTO_INCREMENT,
    product_name       VARCHAR(150)   NOT NULL,
    category           VARCHAR(50)    NOT NULL,
    selling_unit       VARCHAR(20)    NOT NULL,
    price_per_unit     DECIMAL(10,2)  NOT NULL,
    weight_per_unit_kg DECIMAL(5,2)   NOT NULL,
    stock_quantity     DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    PRIMARY KEY (product_id),
    CONSTRAINT chk_stock CHECK (stock_quantity >= 0)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id           INT            NOT NULL AUTO_INCREMENT,
    customer_id        INT            NOT NULL,
    product_id         INT            NULL,          -- Kept for backward compatibility
    quantity           DECIMAL(10,2)  NULL,          -- Kept for backward compatibility
    total_price        DECIMAL(10,2)  NOT NULL,
    status             VARCHAR(50)    NOT NULL DEFAULT 'Pending Review',
    dispatch_mode      VARCHAR(50)    NOT NULL DEFAULT 'Pending Review',
    partner_id         INT            NULL,
    delivery_address   VARCHAR(255)   NOT NULL,
    payment_mode       VARCHAR(50)    NOT NULL,
    distance_km        DECIMAL(5,2)   NULL,
    estimated_delivery INT            NULL,      -- minutes
    created_at         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (order_id),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
        REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_product  FOREIGN KEY (product_id)
        REFERENCES products (product_id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_partner  FOREIGN KEY (partner_id)
        REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    item_id            INT            NOT NULL AUTO_INCREMENT,
    order_id           INT            NOT NULL,
    product_id         INT            NOT NULL,
    quantity           DECIMAL(10,2)  NOT NULL,
    unit_price         DECIMAL(10,2)  NOT NULL,
    total_price        DECIMAL(10,2)  NOT NULL,
    PRIMARY KEY (item_id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
        REFERENCES orders (order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
        REFERENCES products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA: Users
-- All passwords = "password123" (pbkdf2:sha256 via werkzeug)
-- ============================================================
INSERT INTO users (full_name, email, password, phone, account_status, vehicle_type) VALUES

-- Manager
('Tanishk Yadav',
 'tanishk@manager.com',
 'pbkdf2:sha256:1000000$dP5de8BXEsdpg8q0$fd15891ef540e90819f9690c30636c523ed5365e021423bd5de728135178b8c2',
 '9800000001', 'Active', NULL),

-- Customers
('Agam Jain',
 'agam@customer.com',
 'pbkdf2:sha256:1000000$7LI1pbpNP4uzNe51$df22b1c4954ffbdb5d30d62df7acdbd3952b51b0985898e37c083b5af3898a0a',
 '9800000002', 'Active', NULL),

('Saksham Kejriwal',
 'saksham@customer.com',
 'pbkdf2:sha256:1000000$NX1Ke5Ckezv4ZbBQ$faa08c88b3439171be1df92ada6b26ea137a9f896795dccbfa17b369ae3f2bfc',
 '9800000003', 'Active', NULL),

('Aryan Goyal',
 'aryan@customer.com',
 'pbkdf2:sha256:1000000$e54wV7cKg2HRAADc$9d75c61107d300f717666999560da9658d0fbfb56fc8df5445613f98546b21cc',
 '9800000004', 'Active', NULL),

-- Delivery Partners
('Saksham Chauhan',
 'chauhan@delpart.com',
 'pbkdf2:sha256:1000000$oPhMicbyD6rao9HW$0968fcf953b45136e27a85470fc2a0d4007e2079ef4cf2b26c0f6c57551f58eb',
 '9800000005', 'Active', 'Two-Wheeler'),

('Rishabh',
 'rishabh@delpart.com',
 'pbkdf2:sha256:1000000$uiFvdsMhdHx55VVJ$d6f1fda9416396d3428d33e0c6bca1a225189394461720f7511866bfe090fe40',
 '9800000006', 'Active', 'Van');

-- ============================================================
-- SEED DATA: Products (13 items across all 6 categories)
-- ============================================================
INSERT INTO products (product_name, category, selling_unit, price_per_unit, weight_per_unit_kg, stock_quantity) VALUES

-- Grocery (3)
('Basmati Rice',       'Grocery',     'kg',    65.00,  1.00, 200.00),
('Sunflower Oil',      'Grocery',     'liter',  140.00, 0.92, 150.00),
('Whole Wheat Flour',  'Grocery',     'kg',    45.00,  1.00, 180.00),

-- Electronics (2)
('LED Smart TV 43"',   'Electronics', 'piece', 28999.00, 12.50, 15.00),
('Bluetooth Speaker',  'Electronics', 'piece',  1499.00,  0.60, 40.00),

-- Smartphones (2)
('Redmi Note 13',      'Smartphones', 'piece', 17499.00,  0.19, 30.00),
('Samsung Galaxy A35', 'Smartphones', 'piece', 26999.00,  0.20, 20.00),

-- Accessories (2)
('USB-C Fast Charger', 'Accessories', 'piece',   799.00,  0.08, 80.00),
('Laptop Backpack',    'Accessories', 'piece',  1299.00,  0.55, 50.00),

-- Wearables (2)
('Noise ColorFit Pro', 'Wearables',   'piece',  2499.00,  0.04, 60.00),
('boAt Airdopes 141',  'Wearables',   'piece',  1299.00,  0.05, 75.00),

-- General (2)
('A4 Paper Ream (500 sheets)', 'General', 'box',   399.00,  2.50, 100.00),
('Ballpoint Pen Set (10 pcs)', 'General', 'box',    99.00,  0.10, 200.00);
