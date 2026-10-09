-- Database-level guards (SQLite cannot add CHECK constraints without rebuilding the
-- table, which would risk cascading deletes of order_items). Triggers give the same protection.
CREATE TRIGGER `orders_validate_insert` BEFORE INSERT ON `orders`
BEGIN
  SELECT RAISE(ABORT, 'invalid order_type') WHERE NEW.order_type NOT IN ('delivery', 'dine_in');
  SELECT RAISE(ABORT, 'invalid status') WHERE NEW.status NOT IN ('received', 'preparing', 'ready', 'collected', 'out_for_delivery', 'delivered', 'cancelled');
  SELECT RAISE(ABORT, 'invalid payment_method') WHERE NEW.payment_method NOT IN ('mtn', 'telecel', 'at', 'card');
  SELECT RAISE(ABORT, 'invalid amounts') WHERE NEW.subtotal < 0 OR NEW.delivery_fee < 0 OR NEW.total != NEW.subtotal + NEW.delivery_fee;
END;
--> statement-breakpoint
CREATE TRIGGER `orders_validate_update` BEFORE UPDATE OF `order_type`, `status`, `payment_method`, `subtotal`, `delivery_fee`, `total` ON `orders`
BEGIN
  SELECT RAISE(ABORT, 'invalid order_type') WHERE NEW.order_type NOT IN ('delivery', 'dine_in');
  SELECT RAISE(ABORT, 'invalid status') WHERE NEW.status NOT IN ('received', 'preparing', 'ready', 'collected', 'out_for_delivery', 'delivered', 'cancelled');
  SELECT RAISE(ABORT, 'invalid payment_method') WHERE NEW.payment_method NOT IN ('mtn', 'telecel', 'at', 'card');
  SELECT RAISE(ABORT, 'invalid amounts') WHERE NEW.subtotal < 0 OR NEW.delivery_fee < 0 OR NEW.total != NEW.subtotal + NEW.delivery_fee;
END;
--> statement-breakpoint
CREATE TRIGGER `order_items_validate_insert` BEFORE INSERT ON `order_items`
BEGIN
  SELECT RAISE(ABORT, 'invalid item') WHERE NEW.quantity < 1 OR NEW.quantity > 20 OR NEW.unit_price < 0;
END;
--> statement-breakpoint
CREATE TRIGGER `order_items_validate_update` BEFORE UPDATE OF `quantity`, `unit_price` ON `order_items`
BEGIN
  SELECT RAISE(ABORT, 'invalid item') WHERE NEW.quantity < 1 OR NEW.quantity > 20 OR NEW.unit_price < 0;
END;
