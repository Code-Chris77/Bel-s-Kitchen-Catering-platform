ALTER TABLE `orders` ADD `updated_by` text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
-- Every new order and every status change is recorded, whichever code path made it.
CREATE TRIGGER `orders_event_on_insert` AFTER INSERT ON `orders`
BEGIN
  INSERT INTO `order_events` (`order_id`, `from_status`, `to_status`, `actor`)
  VALUES (NEW.`id`, NULL, NEW.`status`, 'customer');
END;
--> statement-breakpoint
CREATE TRIGGER `orders_event_on_status_change` AFTER UPDATE OF `status` ON `orders`
WHEN OLD.`status` != NEW.`status`
BEGIN
  INSERT INTO `order_events` (`order_id`, `from_status`, `to_status`, `actor`)
  VALUES (NEW.`id`, OLD.`status`, NEW.`status`, NEW.`updated_by`);
END;
