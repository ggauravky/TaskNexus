import { useMemo, useState } from "react";
import { HeartHandshake, Loader2, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import PublicSiteLayout from "../components/marketing/PublicSiteLayout";

const presetAmounts = [10, 25, 50, 100];

const initialForm = {
  fullName: "",
  email: "",
  amount: 25,
  currency: "USD",
  message: "",
};

const SupportJarPage = () => {
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [successState, setSuccessState] = useState(null);

  const formattedAmount = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: formData.currency || "USD",
      }).format(Number(formData.amount || 0));
    } catch (error) {
      return `${formData.currency} ${formData.amount}`;
    }
  }, [formData.amount, formData.currency]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: name === "amount" ? value : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        amount: Number(formData.amount),
        currency: formData.currency.trim().toUpperCase(),
        message: formData.message.trim(),
      };

      const response = await api.post("/public/support-jar", payload);
      const contribution = response.data?.data?.contribution;
      setSuccessState({
        amount: contribution?.amount,
        currency: contribution?.currency,
        name: contribution?.full_name,
      });
      setFormData(initialForm);
      toast.success("Support pledge recorded. No payment was processed.");
    } catch (error) {
      const message =
        error.response?.data?.error?.message || "Unable to record support right now.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicSiteLayout
      eyebrow="Support Jar"
      title="If the work helps, record your support."
      subtitle="The support jar records a non-binding expression of support and sends a thank-you email. It does not collect or transfer money."
      heroAside={
        <div className="space-y-5 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
            <HeartHandshake className="h-4 w-4" />
            Appreciation
          </div>
          <h2 className="text-2xl font-semibold">Small signal, real help</h2>
          <p className="text-sm leading-7 text-slate-200">
            A support pledge tells us the product or public work was useful. No payment method is requested and no funds are transferred.
          </p>
        </div>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="space-y-5">
          <div className="public-surface">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              <Sparkles className="h-4 w-4" />
              What happens next
            </div>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <li>You record an optional pledge amount and note.</li>
              <li>TaskNexus records the pledge details; no payment occurs.</li>
              <li>You receive a proper super-thanks email with your name and amount.</li>
            </ul>
          </div>

          {successState ? (
            <div className="public-success-card">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Support pledge recorded
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                Thank you, {successState.name}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                We recorded your support pledge of {successState.currency} {successState.amount}. No payment was processed; the thank-you email has been queued.
              </p>
            </div>
          ) : null}
        </div>

        <form className="public-form-card space-y-4" onSubmit={handleSubmit}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Support pledge form
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Support TaskNexus</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Record an optional pledge amount and note. This form does not process a payment.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="fullName" value={formData.fullName} onChange={handleChange} required />
            <Field label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required />
          </div>

          <fieldset>
            <legend className="label">Suggested pledge amounts</legend>
            <div className="flex flex-wrap gap-2">
              {presetAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setFormData((previous) => ({ ...previous, amount }))}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    Number(formData.amount) === amount
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-amber-300"
                  }`}
                >
                  {formData.currency} {amount}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field
              label="Pledge amount (not charged)"
              name="amount"
              type="number"
              min="1"
              step="0.01"
              value={formData.amount}
              onChange={handleChange}
              required
            />
            <Field
              label="Currency"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              maxLength="3"
              required
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Recorded pledge: <span className="font-semibold text-slate-900">{formattedAmount}</span>
          </div>

          <div>
            <label className="label" htmlFor="message">
              Message (optional)
            </label>
            <textarea
              id="message"
              name="message"
              rows="5"
              value={formData.message}
              onChange={handleChange}
              className="input min-h-[132px]"
              placeholder="If you want, leave a short note about what was useful."
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full inline-flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
            <span>{loading ? "Recording pledge..." : "Record support pledge"}</span>
          </button>
        </form>
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

export default SupportJarPage;
