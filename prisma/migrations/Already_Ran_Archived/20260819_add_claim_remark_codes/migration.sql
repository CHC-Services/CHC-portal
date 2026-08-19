-- Adds a place for admin to record CARC/RARC remark codes from the EOB on a
-- claim, so they can be shown to the nurse on their claim view.
ALTER TABLE "Claim" ADD COLUMN "remarkCodes" TEXT;
