-- Lets an admin event be either all-day (Eastern midnight of the intended
-- date) or a real timed event (Eastern wall-clock instant), instead of every
-- event silently being stored as raw UTC midnight of the date string — which
-- is what produced the "shows up at 8 PM" symptom (UTC midnight is 8 PM/7 PM
-- the *previous* Eastern evening, depending on DST).
ALTER TABLE "GlobalEvent" ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT true;

-- Every existing row was created before this field existed, from a date-only
-- picker with no real time intended — "all day" (the column default above)
-- is the correct reading of that data, but eventDate itself still needs
-- correcting from raw UTC midnight to actual Eastern midnight, or these rows
-- will keep landing on the wrong calendar day once the app starts reading
-- allDay. eventDate::date recovers the originally-intended calendar date
-- (safe because it was stored as literal UTC midnight of that exact date);
-- the double AT TIME ZONE re-expresses that date as Eastern midnight,
-- DST-aware via Postgres's own tzdata rather than a fixed offset.
UPDATE "GlobalEvent"
SET "eventDate" = (("eventDate"::date)::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC'
WHERE "allDay" = true;
