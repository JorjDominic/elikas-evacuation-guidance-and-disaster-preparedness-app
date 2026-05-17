-- ──────────────────────────────────────────────────────────────────────────────
-- eLikas — Public landing stats function
-- Returns aggregate counts visible on the public landing page without
-- requiring the caller to be authenticated (SECURITY DEFINER bypasses RLS).
-- ──────────────────────────────────────────────────────────────────────────────

create or replace function get_landing_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'centers',        (select count(*)                 from evacuation_centers),
    'municipalities', (select count(distinct municipality) from evacuation_centers),
    'barangays',      (select count(distinct barangay)    from evacuation_centers where barangay is not null)
  );
$$;

-- Grant execution to both unauthenticated (anon) and authenticated callers
grant execute on function get_landing_stats() to anon, authenticated;
