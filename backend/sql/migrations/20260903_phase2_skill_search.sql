-- Phase 2 canonical skill search, including aliases and strict result bounds.
CREATE OR REPLACE FUNCTION search_skills(
  p_query TEXT DEFAULT '',
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS SETOF skills
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM skills s
  WHERE s.is_active
    AND (p_category IS NULL OR p_category = '' OR s.category = p_category)
    AND (
      trim(COALESCE(p_query, '')) = ''
      OR s.name ILIKE '%' || trim(p_query) || '%'
      OR s.slug ILIKE '%' || trim(p_query) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(s.aliases) alias
        WHERE alias ILIKE '%' || trim(p_query) || '%'
      )
    )
  ORDER BY
    CASE WHEN lower(s.name) = lower(trim(COALESCE(p_query, ''))) THEN 0 ELSE 1 END,
    s.name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 30);
$$;

REVOKE ALL ON FUNCTION search_skills(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION search_skills(TEXT, TEXT, INTEGER) TO service_role;
