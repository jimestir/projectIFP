-- CreateTable
CREATE TABLE "health_checks" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'ok',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_checks_pkey" PRIMARY KEY ("id")
);
