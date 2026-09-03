-- Complete the Phase 2 catalog with foundational collaboration skills.
INSERT INTO skills (slug, name, category, aliases) VALUES
  ('git', 'Git', 'cloud-devops', ARRAY['version control']),
  ('github', 'GitHub', 'collaboration', ARRAY['github actions', 'github workflows']),
  ('cybersecurity', 'Cybersecurity', 'quality', ARRAY['information security', 'appsec'])
ON CONFLICT DO NOTHING;
