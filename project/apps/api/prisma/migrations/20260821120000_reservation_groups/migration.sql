-- CreateEnum
CREATE TYPE "ReservationGroupStatus" AS ENUM ('CONFIRMED', 'PARTIALLY_PICKED_UP', 'PICKED_UP', 'CANCELLED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE 'NOT_PICKED_UP';

-- CreateTable
CREATE TABLE "reservation_groups" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pharmacy_id" UUID NOT NULL,
    "status" "ReservationGroupStatus" NOT NULL DEFAULT 'CONFIRMED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_groups_pkey" PRIMARY KEY ("id")
);

-- Add group_id and assign one group per existing reservation
ALTER TABLE "reservations" ADD COLUMN "group_id" UUID;
UPDATE "reservations" SET "group_id" = gen_random_uuid() WHERE "group_id" IS NULL;

INSERT INTO "reservation_groups" ("id", "user_id", "pharmacy_id", "status", "expires_at", "created_at", "updated_at")
SELECT
  r."group_id",
  r."user_id",
  r."pharmacy_id",
  CASE
    WHEN r."status" = 'PICKED_UP' THEN 'PICKED_UP'::"ReservationGroupStatus"
    WHEN r."status" = 'CANCELLED' THEN 'CANCELLED'::"ReservationGroupStatus"
    WHEN r."status" = 'EXPIRED' THEN 'EXPIRED'::"ReservationGroupStatus"
    ELSE 'CONFIRMED'::"ReservationGroupStatus"
  END,
  r."expires_at",
  r."created_at",
  r."updated_at"
FROM "reservations" r;

ALTER TABLE "reservations" ALTER COLUMN "group_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "reservation_groups_user_id_idx" ON "reservation_groups"("user_id");
CREATE INDEX "reservation_groups_pharmacy_id_status_idx" ON "reservation_groups"("pharmacy_id", "status");
CREATE INDEX "reservation_groups_status_expires_at_idx" ON "reservation_groups"("status", "expires_at");
CREATE INDEX "reservations_group_id_idx" ON "reservations"("group_id");

-- AddForeignKey
ALTER TABLE "reservation_groups" ADD CONSTRAINT "reservation_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_groups" ADD CONSTRAINT "reservation_groups_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "reservation_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
