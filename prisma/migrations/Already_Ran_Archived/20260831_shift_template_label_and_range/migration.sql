-- Label templates so multiple templates on one patient are distinguishable
-- (e.g. one per nurse), and switch duration from a fixed 4/8/12hr picker to
-- a value computed from a start/end time range, which can be fractional.
ALTER TABLE "ShiftTemplate" ADD COLUMN "label" TEXT;
ALTER TABLE "ShiftTemplate" ALTER COLUMN "durationHours" TYPE DOUBLE PRECISION;
