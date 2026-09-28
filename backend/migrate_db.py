"""
Database Migration Script:
Creates order_items table if not exists, ensures orders columns are nullable for multi-item support,
and migrates existing single-product orders into order_items.
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_connection

def run_migration():
    print("Connecting to database...")
    try:
        conn = get_connection()
    except Exception as e:
        print(f"Error connecting to MySQL: {e}")
        return False

    try:
        with conn.cursor() as cur:
            print("1. Creating table 'order_items' if not exists...")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS order_items (
                    item_id        INT            NOT NULL AUTO_INCREMENT,
                    order_id       INT            NOT NULL,
                    product_id     INT            NOT NULL,
                    quantity       DECIMAL(10,2)  NOT NULL,
                    unit_price     DECIMAL(10,2)  NOT NULL,
                    total_price    DECIMAL(10,2)  NOT NULL,
                    PRIMARY KEY (item_id),
                    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
                        REFERENCES orders (order_id) ON DELETE CASCADE,
                    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
                        REFERENCES products (product_id) ON DELETE RESTRICT
                ) ENGINE=InnoDB;
            """)

            print("2. Modifying orders table to allow NULL for product_id and quantity...")
            try:
                cur.execute("ALTER TABLE orders MODIFY COLUMN product_id INT NULL;")
                cur.execute("ALTER TABLE orders MODIFY COLUMN quantity DECIMAL(10,2) NULL;")
            except Exception as e:
                print(f"Note on altering orders columns: {e}")

            print("3. Backfilling historical single-item orders into order_items...")
            cur.execute("""
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
                SELECT o.order_id, o.product_id, o.quantity, COALESCE(p.price_per_unit, o.total_price / o.quantity), o.total_price
                FROM orders o
                LEFT JOIN products p ON o.product_id = p.product_id
                WHERE o.product_id IS NOT NULL
                  AND o.order_id NOT IN (SELECT DISTINCT order_id FROM order_items);
            """)
            migrated_count = cur.rowcount
            print(f"Backfilled {migrated_count} orders into order_items.")

        conn.commit()
        print("Migration completed successfully!")
        return True
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    run_migration()
