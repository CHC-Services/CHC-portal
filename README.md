# CHC Portal

Portal access for home health nursing professionals.

## Tech Stack

- Next.js
- Prisma
- SQLite (dev)
- TypeScript

## Getting Started

Install dependencies:

```bash
npm install
```

### Database setup & migrations

The Prisma schema has been extended with nurse profile fields (address, billing info, etc.) and an internal `name` on the `User` model.
After pulling the latest code run:

```bash
npx prisma migrate dev --name add_profile_fields
```

A sample SQL migration file (`prisma/migrations/20260301_add_profile_fields/migration.sql`) is included; running the command will apply it and regenerate the client.

### Profiles & authentication

- Nurses can update their display name, contact info, billing details and password via **/nurse/profile**.
- Admins create accounts and set the internal `name` (not editable by the nurse).
- The auth token now carries both `name` and `displayName`; the banner/dashboard show the appropriate value.
