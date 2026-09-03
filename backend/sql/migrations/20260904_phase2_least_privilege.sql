-- Narrow Phase 2 service-role privileges to the operations used by Express.
REVOKE ALL ON TABLE user_profiles, skills, user_skills, user_education FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE user_profiles TO service_role;
GRANT SELECT ON TABLE skills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_skills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_education TO service_role;
