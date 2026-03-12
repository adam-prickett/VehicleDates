CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_number` text NOT NULL,
	`v5_document_number` text,
	`model` text,
	`notes` text,
	`make` text,
	`colour` text,
	`year_of_manufacture` integer,
	`fuel_type` text,
	`engine_capacity` integer,
	`co2_emissions` integer,
	`date_of_last_v5c_issued` text,
	`tax_status` text,
	`tax_due_date` text,
	`mot_status` text,
	`mot_expiry_date` text,
	`insurance_expiry_date` text,
	`insurance_provider` text,
	`service_date` text,
	`service_interval_months` integer,
	`dvla_last_refreshed` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_registration_number_unique` ON `vehicles` (`registration_number`);