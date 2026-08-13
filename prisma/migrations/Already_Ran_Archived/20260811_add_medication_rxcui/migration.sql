-- AlterTable: capture RxNorm concept id (rxcui) on saved medications and on the
-- DrugName typeahead cache, to power the MedlinePlus Connect drug-facts lookup.
ALTER TABLE "PatientMedication" ADD COLUMN "rxcui" TEXT;
ALTER TABLE "DrugName" ADD COLUMN "rxcui" TEXT;
