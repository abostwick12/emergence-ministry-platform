// Ministry scope constants.
//
// The application currently runs as a SINGLE-MINISTRY deployment. A real
// ministry scope still exists in the database (the `ministries` table) so that
// future EMMA records and future multi-ministry/churchwide scaling can attach
// to the correct ministry from day one.
//
// The default "Emerge" ministry is seeded with a FIXED id in both the SQL
// schema/migration and here, so server code, mock/Stub Mode, and the database
// all agree on the same default scope without an extra lookup.
//
// This module is intentionally dependency-free (no Next.js / Supabase imports)
// so it can be shared by the mock store, the server scope helper, and tests.

export interface Ministry {
  id: string;
  name: string;
  slug: string;
}

/**
 * The default ministry for the current single-ministry deployment.
 * Must stay in sync with the seeded `ministries` row in
 * `supabase/schema.sql` and `supabase/migrations/005_ministry_scope.sql`.
 */
export const DEFAULT_MINISTRY: Ministry = {
  id: "00000000-0000-4000-8000-0000000000e1",
  name: "Emerge",
  slug: "emerge"
};

export const DEFAULT_MINISTRY_ID = DEFAULT_MINISTRY.id;
