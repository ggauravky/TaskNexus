ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'newsletter_subscription';
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'service_booking';
ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'support_jar_contribution';

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'blog',
  status TEXT NOT NULL DEFAULT 'subscribed',
  brevo_contact_id BIGINT,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_email ON newsletter_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_status ON newsletter_subscriptions(status);

CREATE TABLE IF NOT EXISTS service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service_slug TEXT NOT NULL,
  service_snapshot JSONB NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  timezone TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  email_status TEXT NOT NULL DEFAULT 'pending',
  brevo_message_ids JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_bookings_booking_id ON service_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_email ON service_bookings(email);
CREATE INDEX IF NOT EXISTS idx_service_bookings_status ON service_bookings(status);

CREATE TABLE IF NOT EXISTS support_jar_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL,
  message TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending',
  brevo_message_ids JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_jar_contributions_email ON support_jar_contributions(email);
CREATE INDEX IF NOT EXISTS idx_support_jar_contributions_created_at ON support_jar_contributions(created_at);
