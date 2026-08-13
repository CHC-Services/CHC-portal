-- CreateTable: DrugName — local cache of NIH drug names for the medication-name typeahead
CREATE TABLE "DrugName" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugName_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DrugName_displayName_key" ON "DrugName"("displayName");
CREATE INDEX "DrugName_displayName_idx" ON "DrugName"("displayName");
