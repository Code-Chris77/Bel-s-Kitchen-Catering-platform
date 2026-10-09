CREATE TABLE `delivery_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`fee` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`accent` text DEFAULT '' NOT NULL,
	`image` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_tiers` (
	`amount` integer PRIMARY KEY NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`iterations` integer NOT NULL,
	`session_version` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_name_unique` ON `staff` (`name`);--> statement-breakpoint
INSERT OR IGNORE INTO `menu_items` (`id`, `name`, `note`, `accent`, `image`, `alt`, `sort_order`, `active`) VALUES
	('fried', 'Fried Rice', 'Smoky, colourful and made fresh to order.', 'Golden wok flavour', '/menu-fried-rice.webp', 'Fried rice with glazed grilled chicken', 1, 1),
	('jollof', 'Jollof Rice', 'Rich tomato spice with that deep party-jollof finish.', 'Slow-cooked Ghana flavour', '/menu-jollof-rice.webp', 'Ghanaian jollof rice with glazed grilled chicken', 2, 1),
	('mixed', 'The Mix', 'Fried rice and jollof, side by side in one generous bowl.', 'Two favourites, one plate', '/menu-mixed-rice.webp', 'Fried rice and jollof rice mixed on one plate with grilled chicken', 3, 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `price_tiers` (`amount`, `active`) VALUES (35, 1), (40, 1), (50, 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `delivery_zones` (`id`, `label`, `fee`, `sort_order`, `active`) VALUES
	('accra', 'Accra', 30, 1, 1),
	('tema', 'Tema', 50, 2, 1),
	('outside', 'Outside Accra', 80, 3, 1);
