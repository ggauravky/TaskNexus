-- Phase 2 RPCs execute only as the calling service role. The service role has
-- the required table grants and bypasses RLS; elevated function rights are not needed.
ALTER FUNCTION replace_user_skills(UUID, JSONB) SECURITY INVOKER;
ALTER FUNCTION search_skills(TEXT, TEXT, INTEGER) SECURITY INVOKER;

REVOKE ALL ON FUNCTION replace_user_skills(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION search_skills(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_user_skills(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION search_skills(TEXT, TEXT, INTEGER) TO service_role;
