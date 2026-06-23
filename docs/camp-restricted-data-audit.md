# Camp Restricted Data Audit

> **Reference**: This audit informed migration 008 and the current access model. For the current Camp feature blueprint and access model, see [`docs/camp/CAMP_BLUEPRINT.md`](camp/CAMP_BLUEPRINT.md) and [`docs/camp/CAMP_ACCESS_MODEL.md`](camp/CAMP_ACCESS_MODEL.md).

Checked Camp API routes, repository methods, import parsing, UI fetch boundaries, and Supabase RLS policies for medical/medication leakage before real camp data entry.

Findings and fixes:

- Public Camp overview responses are authenticated and continue to return only roster, team, vehicle, schedule, document, and safe boolean data.
- Restricted medical, medication, and import routes derive access server-side; query-string role values alone do not grant live restricted access.
- Restricted access now relies on authenticated email identity for Andrew, Jaci, and Joel, not mutable display/profile names.
- Public safety flags are sanitized through a safe-label allowlist so arbitrary medication or medical detail text cannot leak in general-leader roster payloads.
- Camp import batch metadata RLS is tightened to restricted users to avoid future import-audit side channels.
- Medication administration logs remain restricted and append-only at the RLS policy layer.
