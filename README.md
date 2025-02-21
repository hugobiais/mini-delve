# mini-delve

mini-delve is a lightweight security compliance checker for Supabase projects—an inspiration drawn from [Delve](https://www.delve.co/). It automatically scans your Supabase configuration for common security best practices and logs detailed evidence of compliance or failures. The tool runs automated checks for Multi-Factor Authentication (MFA), Row Level Security (RLS), and Point-in-Time Recovery (PITR).

## Testing the project

To test the project, go to [mini-delve-omega.vercel.app](https://mini-delve-omega.vercel.app/). I recommend signing up with whatever email (doesn't really matter). After that, you can connect either a brand new Supabase organization (create a quick table in a new project to test the RLS check) or use your own. The checks won't work on projects that are INACTIVE.

## Features

### User Authentication & Organization Connection

- Magic link sign‑in using Supabase Auth
- OAuth integration for connecting Supabase organizations
- Support for linking multiple organization connections per user (each connection is unique to the user)

### Security Checks

- **MFA Check**: Verifies that all organization members have MFA enabled.
- **RLS Check**: Ensures that RLS is enabled on all tables.
- **PITR Check**: Confirms that PITR is enabled for each Supabase project.

### Evidence Collection

- Detailed logging of each check with timestamps, results, and actionable recommendations.
- Grouping of checks when running a full scan (all three checks executed together).

## Architecture

### Data Model

The core data model leverages Supabase's built‑in auth.users for user identity. The main tables are:

### users

Represents the user of mini-delve

**Columns:**

- id (UUID)
- email (text)
- created_at

### organizations

Represents a connection between a user and a Supabase organization.

**Columns:**

- id (serial primary key)
- user_id (UUID)
- supabase_org_id (text)
- organization_name
- access_token
- refresh_token
- token_expires_at
- timestamps

**Uniqueness:** A unique pair of (user_id, supabase_org_id) ensures separation even if two users connect to the same organization.

### checks

Logs each individual check.

**Columns:**

- id
- user_id
- organization_id (foreign key to organizations)
- check_type (e.g., 'mfa', 'rls', 'pitr')
- status ('success' or 'failure')
- logs (JSONB details)
- recommendations (JSONB)
- full_scan_id (nullable foreign key to full_scans)
- created_at

### full_scans

Groups the three checks (MFA, RLS, PITR) into a single scan event.

**Columns:**

- id
- user_id
- organization_id (foreign key to organizations)
- scan_timestamp
- created_at

### API Routes

- `api/auth/confirm-magic-link`: Handles Supabase Magic link auth flow
- `/api/auth/supabase-oauth-callback`: Handles Supabase OAuth flow
- `/api/full-scan`: Runs all checks in parallel
- `/api/mfa-check`: Runs MFA-specific check
- `/api/rls-check`: Runs RLS-specific check
- `/api/pitr-check`: Runs PITR-specific check

## Implementation Details

### Authentication Flow

1. Users sign in with magic link (email)
2. Users connect Supabase organizations via OAuth
3. Access tokens are stored on the server (organizations table)

### Check Execution

- Individual checks can be run separately or as part of a full scan
- Full scans run all checks in parallel for better performance
- Each check:
  1. Validates user authentication
  2. Verifies organization access
  3. Executes check-specific logic
  4. Stores results and recommendations

## Tech used

For this project, I used the following stack:

- NextJS (frontend + API routes)
- Supabase (Auth + PostgresSQL DB)
- Supabase Management API (created an integration `mini-delve` to communicate with the management API)
- Vercel (deployment)

## Future Improvements

Due to the lack of time spent on this project, I could only focus on the core requirements. However, if I were to spend more time on it, I would work on the following feature (would bring the most value to the product):

### Automatic RLS fix

A particularly promising area for automation is the automatic generation and application of Row Level Security (RLS) policies. Using the Supabase Management API, we can query the database to extract the complete public schema, including tables and their relationships. This schema could then be fed to an LLM to generate RLS policies based on the database structure and common security patterns. We would need to craft a good system prompt in which we would inject the schema to get the best results.

Once generated, these policies could be automatically applied using Supabase's query execution endpoint, though with appropriate safety measures like policy validation and user confirmation before application. This approach would significantly reduce the complexity of implementing RLS, while ensuring security best practices are followed. However, **WARNING**, the user should always understand the LLM's recommendation before auto-fixing.

To my knowledge, this RLS auto-fix would be the best to work out of the 3 checks we are running (RLS, PITR, MFA). I don't the other 2 can be auto-fixed.
