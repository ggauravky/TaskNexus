import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import PublicSiteLayout from "../components/marketing/PublicSiteLayout";

const defaultForm = {
  fullName: "",
  email: "",
  phone: "",
  serviceSlug: "",
  preferredDate: "",
  preferredTime: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Calcutta",
  notes: "",
};

const ServicesPage = () => {
  const [services, setServices] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [formData, setFormData] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const response = await api.get("/public/services/catalog");
        const catalog = response.data?.data || [];
        setServices(catalog);
        setFormData((previous) => ({
          ...previous,
          serviceSlug: previous.serviceSlug || catalog[0]?.slug || "",
        }));
      } catch (error) {
        toast.error("Unable to load services right now.");
      } finally {
        setCatalogLoading(false);
      }
    };

    loadCatalog();
  }, []);

  const selectedService = useMemo(
    () => services.find((service) => service.slug === formData.serviceSlug) || services[0] || null,
    [formData.serviceSlug, services]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        notes: formData.notes.trim(),
      };

      const response = await api.post("/public/services/book", payload);
      const booking = response.data?.data?.booking;
      setConfirmation({
        bookingId: booking?.booking_id,
        sessionId: booking?.session_id,
        serviceName: booking?.service_snapshot?.name,
        preferredDate: booking?.preferred_date,
        preferredTime: booking?.preferred_time,
        timezone: booking?.timezone,
      });
      setFormData((previous) => ({
        ...defaultForm,
        serviceSlug: previous.serviceSlug,
        timezone: previous.timezone,
      }));
      toast.success("Service request recorded. Check your email for the request summary.");
    } catch (error) {
      const message =
        error.response?.data?.error?.message || "Unable to record your service request right now.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicSiteLayout
      eyebrow="Services"
      title="Request a focused session without the usual back-and-forth."
      subtitle="Choose a TaskNexus service and share your preferred date and time. We record the request and email a summary; availability is confirmed separately."
      heroAside={
        <div className="space-y-5 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
            <CalendarClock className="h-4 w-4" />
            Request flow
          </div>
          <h2 className="text-2xl font-semibold">Immediate request summary</h2>
          <ul className="space-y-3 text-sm leading-7 text-slate-200">
            <li className="flex gap-3">
              <ShieldCheck className="mt-1 h-4 w-4 text-cyan-200" />
              <span>Your preferred timing is recorded right after submission.</span>
            </li>
            <li className="flex gap-3">
              <Sparkles className="mt-1 h-4 w-4 text-cyan-200" />
              <span>You receive an email and PDF summarizing the request.</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-1 h-4 w-4 text-cyan-200" />
              <span>No payment is collected; final availability is confirmed separately.</span>
            </li>
          </ul>
        </div>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="space-y-5">
          {catalogLoading ? (
            <div className="public-surface flex items-center gap-3 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading services...</span>
            </div>
          ) : (
            services.map((service) => {
              const isActive = selectedService?.slug === service.slug;
              return (
                <button
                  key={service.slug}
                  type="button"
                  onClick={() =>
                    setFormData((previous) => ({ ...previous, serviceSlug: service.slug }))
                  }
                  className={`public-surface w-full text-left transition-all ${
                    isActive ? "ring-2 ring-sky-400 ring-offset-2" : "hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
                        {service.durationLabel}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                        {service.name}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {service.fullDescription}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Starting at
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {service.priceLabel}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    {service.highlights?.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-sky-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-6">
          <form className="public-form-card space-y-4" onSubmit={handleSubmit}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Service request
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {selectedService?.name || "Choose a service"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Pick the service and preferred timing. This records a request, not a guaranteed appointment.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="fullName" value={formData.fullName} onChange={handleChange} required />
              <Field label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" name="phone" value={formData.phone} onChange={handleChange} />
              <SelectField
                label="Service"
                name="serviceSlug"
                value={formData.serviceSlug}
                onChange={handleChange}
                options={services.map((service) => ({ value: service.slug, label: service.name }))}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Preferred date"
                name="preferredDate"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={formData.preferredDate}
                onChange={handleChange}
                required
              />
              <Field
                label="Preferred time"
                name="preferredTime"
                type="time"
                value={formData.preferredTime}
                onChange={handleChange}
                required
              />
            </div>

            <Field
              label="Timezone"
              name="timezone"
              value={formData.timezone}
              onChange={handleChange}
              required
            />

            <div>
              <label htmlFor="service-notes" className="label">Notes</label>
              <textarea
                id="service-notes"
                name="notes"
                rows="5"
                value={formData.notes}
                onChange={handleChange}
                className="input min-h-[132px]"
                placeholder="Share context, constraints, or anything we should prep before the session."
              />
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting ? "Recording request..." : selectedService?.ctaLabel || "Request service"}
            </button>
          </form>

          {confirmation ? (
            <div className="public-success-card">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-semibold uppercase tracking-[0.14em]">
                  Request recorded
                </p>
              </div>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">
                {confirmation.serviceName}
              </h3>
              <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <Detail label="Request ID" value={confirmation.bookingId} />
                <Detail label="Session reference" value={confirmation.sessionId} />
                <Detail label="Preferred date" value={confirmation.preferredDate} />
                <Detail
                  label="Preferred time"
                  value={`${confirmation.preferredTime} (${confirmation.timezone})`}
                />
              </dl>
            </div>
          ) : null}
        </div>
      </section>
    </PublicSiteLayout>
  );
};

const Field = ({ label, name, value, onChange, type = "text", ...rest }) => (
  <div>
    <label className="label" htmlFor={name}>
      {label}
    </label>
    <input id={name} name={name} type={type} value={value} onChange={onChange} className="input" {...rest} />
  </div>
);

const SelectField = ({ label, name, value, onChange, options, ...rest }) => (
  <div>
    <label className="label" htmlFor={name}>
      {label}
    </label>
    <select id={name} name={name} value={value} onChange={onChange} className="input" {...rest}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const Detail = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
    <dd className="mt-1 font-medium text-slate-900">{value}</dd>
  </div>
);

export default ServicesPage;
