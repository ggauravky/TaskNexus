import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock3,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLE_ROUTES = {
  client: "/client/dashboard",
  freelancer: "/freelancer/dashboard",
  admin: "/admin/dashboard",
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (formError) {
      setFormError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setLoading(true);

    const payload = {
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
    };

    const result = await login(payload);

    if (!result.success) {
      setFormError(result.error || "Unable to sign in right now.");
      setLoading(false);
      return;
    }

    navigate(ROLE_ROUTES[result.user.role] || "/");
  };

  return (
    <div className="auth-shell">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-orb auth-orb-three" />

      <div className="auth-wrapper">
        <section className="auth-brand-panel">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-icon">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <span className="auth-brand-title">TaskNexus</span>
              <span className="auth-brand-subtitle">Managed delivery platform</span>
            </span>
          </Link>

          <h1 className="auth-title">Sign in and get back to shipping work</h1>
          <p className="auth-copy">
            Review progress, manage active tasks, and keep communication tight between
            client requests and freelancer delivery.
          </p>

          <div className="auth-benefits">
            <Feature icon={<ShieldCheck className="h-4 w-4" />} text="Secure token-based auth" />
            <Feature icon={<Layers3 className="h-4 w-4" />} text="Role-aware workspaces" />
            <Feature icon={<Clock3 className="h-4 w-4" />} text="Live task timeline visibility" />
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <div>
                <p className="auth-kicker">Welcome back</p>
                <h2 className="auth-heading">Login to your account</h2>
              </div>
              <Link to="/register" className="btn btn-secondary btn-sm">
                Create account
              </Link>
            </div>

            {formError && <div className="auth-alert">{formError}</div>}

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="email" className="label auth-label">
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input auth-input"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="password" className="label auth-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="input auth-input pr-11"
                    placeholder="********"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="auth-input-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                <span>{loading ? "Signing in..." : "Sign in"}</span>
              </button>
            </form>

            <Link to="/" className="auth-back-link">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

const Feature = ({ icon, text }) => (
  <div className="auth-feature">
    <span className="auth-feature-icon">{icon}</span>
    <span>{text}</span>
  </div>
);

export default Login;
