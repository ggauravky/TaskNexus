import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (formError) setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setLoading(true);

    const result = await login({
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
    });

    if (!result.success) {
      setFormError(result.error || "Unable to authenticate this account.");
      setLoading(false);
      return;
    }

    if (result.user.role !== "admin") {
      await logout({ silent: true });
      setFormError("This sign-in is restricted to provisioned administrator accounts.");
      setLoading(false);
      return;
    }

    navigate("/admin/dashboard");
  };

  return (
    <div className="auth-shell">
      <div className="auth-wrapper">
        <section className="auth-brand-panel">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-icon"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
            <span>
              <span className="auth-brand-title">TaskNexus</span>
              <span className="auth-brand-subtitle">Restricted administration</span>
            </span>
          </Link>

          <h1 className="auth-title">Administrator access is provisioned, not self-service</h1>
          <p className="auth-copy">Use the credentials created through the controlled server-side provisioning process. Public registration cannot create administrator accounts.</p>

          <div className="auth-benefits">
            <Feature icon={ShieldCheck} text="Role authorization is enforced by the API" />
            <Feature icon={LockKeyhole} text="Refresh sessions use a protected HttpOnly cookie" />
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <div>
                <p className="auth-kicker">Restricted access</p>
                <h2 className="auth-heading">Admin sign in</h2>
              </div>
            </div>

            {formError ? <div id="admin-login-error" role="alert" className="auth-alert">{formError}</div> : null}

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="admin-email" className="label auth-label">Admin email</label>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-describedby={formError ? "admin-login-error" : undefined}
                  className="input auth-input"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="label auth-label">Password</label>
                <div className="relative">
                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    aria-describedby={formError ? "admin-login-error" : undefined}
                    className="input auth-input pr-11"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="auth-input-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary min-h-11 w-full">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Authenticating...</> : "Access admin workspace"}
              </button>
            </form>

            <Link to="/login" className="auth-back-link">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> User sign in
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

const Feature = ({ icon: Icon, text }) => (
  <div className="auth-feature">
    <span className="auth-feature-icon"><Icon className="h-4 w-4" aria-hidden="true" /></span>
    <span>{text}</span>
  </div>
);

export default AdminLogin;
