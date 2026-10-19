CREATE TYPE "public"."reason" AS ENUM('damaged', 'wrong_item', 'size_issue', 'not_as_described', 'changed_mind');--> statement-breakpoint
CREATE TYPE "public"."resolution" AS ENUM('refund', 'replacement', 'store_credit');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('open', 'in_review', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"return_request_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "return_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reference" text GENERATED ALWAYS AS ('RD-' || lpad(id::text, greatest(6, length(id::text)), '0')) STORED NOT NULL,
	"order_line_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"reason" "reason" NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"status" "status" DEFAULT 'open' NOT NULL,
	"resolution" "resolution",
	"refund_amount_paise" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "return_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "return_requests_resolution_when_approved" CHECK (("return_requests"."resolution" IS NOT NULL) = ("return_requests"."status" IN ('approved', 'completed'))),
	CONSTRAINT "return_requests_refund_when_refund" CHECK (("return_requests"."refund_amount_paise" IS NOT NULL) = ("return_requests"."resolution" IS NOT DISTINCT FROM 'refund')),
	CONSTRAINT "return_requests_refund_positive" CHECK ("return_requests"."refund_amount_paise" > 0),
	CONSTRAINT "return_requests_quantity_positive" CHECK ("return_requests"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "status_changes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "status_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"return_request_id" integer NOT NULL,
	"from_status" "status",
	"to_status" "status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_changes" ADD CONSTRAINT "status_changes_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_return_request_id_index" ON "notes" USING btree ("return_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_one_live_per_line" ON "return_requests" USING btree ("order_line_id") WHERE status IN ('open', 'in_review', 'approved') AND removed_at IS NULL;--> statement-breakpoint
CREATE INDEX "status_changes_return_request_id_index" ON "status_changes" USING btree ("return_request_id");