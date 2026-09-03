-- TaskNexus V2 Phase 2: canonical professional profiles.
-- The application continues to use a backend-only data-access model. Legacy
-- profile JSON is retained and selectively backfilled into normalized tables.

DO $$ BEGIN
  CREATE TYPE profile_visibility AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE profile_availability AS ENUM ('open', 'limited', 'unavailable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE collaboration_commitment AS ENUM ('exploring', 'few_hours', 'part_time', 'full_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE skill_proficiency AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  headline VARCHAR(120),
  bio VARCHAR(2000),
  avatar_url TEXT,
  location VARCHAR(120),
  timezone VARCHAR(80),
  availability profile_availability NOT NULL DEFAULT 'unavailable',
  collaboration_commitment collaboration_commitment NOT NULL DEFAULT 'exploring',
  github_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  interests TEXT[] NOT NULL DEFAULT '{}',
  preferred_roles TEXT[] NOT NULL DEFAULT '{}',
  visibility profile_visibility NOT NULL DEFAULT 'private',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_username_format CHECK (
    username IS NULL OR username ~ '^[a-z][a-z0-9_-]{2,29}$'
  ),
  CONSTRAINT user_profiles_username_reserved CHECK (
    username IS NULL OR username <> ALL (ARRAY[
      'admin', 'api', 'app', 'auth', 'blog', 'dashboard', 'help', 'login',
      'logout', 'me', 'profile', 'register', 'root', 'security', 'settings',
      'support', 'system', 'tasknexus', 'tasks', 'team', 'teams', 'u', 'users'
    ])
  ),
  CONSTRAINT user_profiles_interests_limit CHECK (cardinality(interests) <= 12),
  CONSTRAINT user_profiles_roles_limit CHECK (cardinality(preferred_roles) <= 8),
  CONSTRAINT user_profiles_avatar_url_safe CHECK (avatar_url IS NULL OR avatar_url ~ '^https://'),
  CONSTRAINT user_profiles_github_url_safe CHECK (github_url IS NULL OR github_url ~ '^https://'),
  CONSTRAINT user_profiles_linkedin_url_safe CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https://'),
  CONSTRAINT user_profiles_portfolio_url_safe CHECK (portfolio_url IS NULL OR portfolio_url ~ '^https://')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_ci
  ON user_profiles(lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_public_username
  ON user_profiles(lower(username)) WHERE visibility = 'public' AND username IS NOT NULL;

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name VARCHAR(80) NOT NULL,
  category VARCHAR(40) NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT skills_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT skills_category_valid CHECK (category = ANY (ARRAY[
    'languages', 'frontend', 'backend', 'mobile', 'database', 'data-ai',
    'cloud-devops', 'design', 'product', 'quality', 'collaboration', 'other'
  ]))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_slug_ci ON skills(lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_ci ON skills(lower(name));
CREATE INDEX IF NOT EXISTS idx_skills_category_name ON skills(category, name);
CREATE INDEX IF NOT EXISTS idx_skills_aliases ON skills USING GIN(aliases);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  proficiency skill_proficiency NOT NULL DEFAULT 'intermediate',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_primary ON user_skills(user_id, is_primary) WHERE is_primary;

CREATE TABLE IF NOT EXISTS user_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution VARCHAR(160) NOT NULL,
  degree_course VARCHAR(160) NOT NULL,
  field_of_study VARCHAR(160),
  start_year SMALLINT NOT NULL,
  end_year SMALLINT,
  currently_studying BOOLEAN NOT NULL DEFAULT false,
  description VARCHAR(1000),
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_education_start_year CHECK (start_year BETWEEN 1900 AND 2100),
  CONSTRAINT user_education_end_year CHECK (end_year IS NULL OR end_year BETWEEN 1900 AND 2100),
  CONSTRAINT user_education_year_order CHECK (end_year IS NULL OR end_year >= start_year),
  CONSTRAINT user_education_current_end CHECK (NOT currently_studying OR end_year IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_education_user_position
  ON user_education(user_id, position, start_year DESC);

INSERT INTO skills (slug, name, category, aliases) VALUES
  ('javascript', 'JavaScript', 'languages', ARRAY['js', 'ecmascript']),
  ('typescript', 'TypeScript', 'languages', ARRAY['ts']),
  ('python', 'Python', 'languages', ARRAY['python3']),
  ('java', 'Java', 'languages', ARRAY[]::TEXT[]),
  ('c-sharp', 'C#', 'languages', ARRAY['csharp', '.net c#']),
  ('go', 'Go', 'languages', ARRAY['golang']),
  ('rust', 'Rust', 'languages', ARRAY[]::TEXT[]),
  ('react', 'React', 'frontend', ARRAY['reactjs', 'react.js']),
  ('next-js', 'Next.js', 'frontend', ARRAY['nextjs', 'next']),
  ('vue-js', 'Vue.js', 'frontend', ARRAY['vue', 'vuejs']),
  ('angular', 'Angular', 'frontend', ARRAY['angularjs']),
  ('tailwind-css', 'Tailwind CSS', 'frontend', ARRAY['tailwind']),
  ('html-css', 'HTML & CSS', 'frontend', ARRAY['html', 'css', 'html5', 'css3']),
  ('node-js', 'Node.js', 'backend', ARRAY['node', 'nodejs']),
  ('express-js', 'Express.js', 'backend', ARRAY['express', 'expressjs']),
  ('django', 'Django', 'backend', ARRAY[]::TEXT[]),
  ('fastapi', 'FastAPI', 'backend', ARRAY['fast api']),
  ('spring-boot', 'Spring Boot', 'backend', ARRAY['spring']),
  ('graphql', 'GraphQL', 'backend', ARRAY['graphql api']),
  ('rest-apis', 'REST APIs', 'backend', ARRAY['rest', 'restful api']),
  ('react-native', 'React Native', 'mobile', ARRAY['react-native']),
  ('flutter', 'Flutter', 'mobile', ARRAY['dart flutter']),
  ('ios-development', 'iOS Development', 'mobile', ARRAY['ios', 'swiftui']),
  ('android-development', 'Android Development', 'mobile', ARRAY['android', 'kotlin android']),
  ('postgresql', 'PostgreSQL', 'database', ARRAY['postgres', 'psql']),
  ('mysql', 'MySQL', 'database', ARRAY[]::TEXT[]),
  ('mongodb', 'MongoDB', 'database', ARRAY['mongo']),
  ('supabase', 'Supabase', 'database', ARRAY[]::TEXT[]),
  ('redis', 'Redis', 'database', ARRAY[]::TEXT[]),
  ('machine-learning', 'Machine Learning', 'data-ai', ARRAY['ml']),
  ('data-analysis', 'Data Analysis', 'data-ai', ARRAY['analytics']),
  ('generative-ai', 'Generative AI', 'data-ai', ARRAY['genai', 'llm']),
  ('aws', 'Amazon Web Services', 'cloud-devops', ARRAY['amazon web services']),
  ('azure', 'Microsoft Azure', 'cloud-devops', ARRAY['azure cloud']),
  ('google-cloud', 'Google Cloud', 'cloud-devops', ARRAY['gcp']),
  ('docker', 'Docker', 'cloud-devops', ARRAY['containers']),
  ('kubernetes', 'Kubernetes', 'cloud-devops', ARRAY['k8s']),
  ('ci-cd', 'CI/CD', 'cloud-devops', ARRAY['continuous integration']),
  ('figma', 'Figma', 'design', ARRAY[]::TEXT[]),
  ('ui-ux-design', 'UI/UX Design', 'design', ARRAY['ux', 'ui design', 'product design']),
  ('product-management', 'Product Management', 'product', ARRAY['product manager']),
  ('project-management', 'Project Management', 'product', ARRAY['project manager']),
  ('automated-testing', 'Automated Testing', 'quality', ARRAY['test automation', 'qa automation']),
  ('technical-writing', 'Technical Writing', 'collaboration', ARRAY['documentation']),
  ('mentoring', 'Mentoring', 'collaboration', ARRAY['coaching'])
ON CONFLICT DO NOTHING;

INSERT INTO user_profiles (
  user_id, headline, bio, avatar_url, location, availability,
  github_url, linkedin_url, portfolio_url
)
SELECT
  u.id,
  NULLIF(trim(u.freelancer_profile->>'title'), ''),
  NULLIF(trim(u.freelancer_profile->>'bio'), ''),
  CASE WHEN u.profile->>'avatar' ~ '^https://' THEN u.profile->>'avatar' ELSE NULL END,
  NULLIF(trim(COALESCE(u.profile->>'location', u.freelancer_profile->>'location')), ''),
  CASE COALESCE(u.freelancer_profile->>'availability', '')
    WHEN 'available' THEN 'open'::profile_availability
    WHEN 'part_time' THEN 'limited'::profile_availability
    ELSE 'unavailable'::profile_availability
  END,
  CASE WHEN u.freelancer_profile->>'github' ~ '^https://' THEN u.freelancer_profile->>'github' ELSE NULL END,
  CASE WHEN u.freelancer_profile->>'linkedin' ~ '^https://' THEN u.freelancer_profile->>'linkedin' ELSE NULL END,
  CASE WHEN COALESCE(u.freelancer_profile->>'portfolio', u.freelancer_profile->>'website') ~ '^https://'
    THEN COALESCE(u.freelancer_profile->>'portfolio', u.freelancer_profile->>'website') ELSE NULL END
FROM users u
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION initialize_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_initialize_profile ON users;
CREATE TRIGGER users_initialize_profile
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION initialize_user_profile();

WITH legacy AS (
  SELECT DISTINCT u.id AS user_id, trim(value) AS raw_name
  FROM users u
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(u.freelancer_profile->'skills') = 'array'
      THEN u.freelancer_profile->'skills' ELSE '[]'::jsonb END
  ) value
  WHERE trim(value) <> ''
), unmatched AS (
  SELECT lower(regexp_replace(regexp_replace(raw_name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) AS slug,
         min(raw_name) AS raw_name
  FROM legacy l
  WHERE NOT EXISTS (
    SELECT 1 FROM skills s
    WHERE lower(s.name) = lower(l.raw_name)
       OR lower(s.slug) = lower(l.raw_name)
       OR lower(l.raw_name) = ANY(s.aliases)
  )
  GROUP BY lower(regexp_replace(regexp_replace(raw_name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
)
INSERT INTO skills (slug, name, category, aliases)
SELECT slug, left(raw_name, 80), 'other', ARRAY[lower(raw_name)]
FROM unmatched
WHERE slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
ON CONFLICT DO NOTHING;

WITH legacy AS (
  SELECT DISTINCT u.id AS user_id, trim(value) AS raw_name
  FROM users u
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(u.freelancer_profile->'skills') = 'array'
      THEN u.freelancer_profile->'skills' ELSE '[]'::jsonb END
  ) value
  WHERE trim(value) <> ''
), resolved AS (
  SELECT DISTINCT ON (l.user_id, l.raw_name) l.user_id, s.id AS skill_id
  FROM legacy l
  JOIN skills s ON lower(s.name) = lower(l.raw_name)
    OR lower(s.slug) = lower(l.raw_name)
    OR lower(l.raw_name) = ANY(s.aliases)
  ORDER BY l.user_id, l.raw_name, s.name
)
INSERT INTO user_skills (user_id, skill_id, proficiency, is_primary)
SELECT user_id, skill_id, 'intermediate', false FROM resolved
ON CONFLICT (user_id, skill_id) DO NOTHING;

CREATE OR REPLACE FUNCTION replace_user_skills(p_user_id UUID, p_skills JSONB)
RETURNS SETOF user_skills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE item_count INTEGER;
DECLARE valid_count INTEGER;
BEGIN
  IF jsonb_typeof(p_skills) <> 'array' THEN
    RAISE EXCEPTION 'skills must be a JSON array' USING ERRCODE = '22023';
  END IF;

  item_count := jsonb_array_length(p_skills);
  IF item_count > 30 THEN
    RAISE EXCEPTION 'a profile may contain at most 30 skills' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(DISTINCT item->>'skillId') FROM jsonb_array_elements(p_skills) item) <> item_count THEN
    RAISE EXCEPTION 'duplicate skills are not allowed' USING ERRCODE = '23505';
  END IF;

  IF (SELECT count(*) FROM jsonb_array_elements(p_skills) item
      WHERE COALESCE((item->>'isPrimary')::boolean, false)) > 5 THEN
    RAISE EXCEPTION 'a profile may contain at most 5 primary skills' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO valid_count
  FROM jsonb_array_elements(p_skills) item
  JOIN skills s ON s.id = (item->>'skillId')::uuid AND s.is_active;
  IF valid_count <> item_count THEN
    RAISE EXCEPTION 'one or more skills are invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM user_skills WHERE user_id = p_user_id;
  RETURN QUERY
  INSERT INTO user_skills (user_id, skill_id, proficiency, is_primary)
  SELECT
    p_user_id,
    (item->>'skillId')::uuid,
    COALESCE(item->>'proficiency', 'intermediate')::skill_proficiency,
    COALESCE((item->>'isPrimary')::boolean, false)
  FROM jsonb_array_elements(p_skills) item
  RETURNING *;
END $$;

REVOKE ALL ON FUNCTION replace_user_skills(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_user_skills(UUID, JSONB) TO service_role;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['user_profiles', 'skills', 'user_skills', 'user_education']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', table_name);
  END LOOP;
END $$;

GRANT ALL ON TABLE user_profiles, skills, user_skills, user_education TO service_role;
