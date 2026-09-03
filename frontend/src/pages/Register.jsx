import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  CheckCircle2,
  Eye,
  EyeOff,
  Laptop2,
  Loader2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { USER_ROLES } from "../utils/constants";

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: USER_ROLES.CLIENT,
    profile: {
      firstName: "",
      lastName: "",
      phone: "",
    },
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      minLength: formData.password.length >= 8,
      lowercase: /[a-z]/.test(formData.password),
      uppercase: /[A-Z]/.test(formData.password),
      number: /[0-9]/.test(formData.password),
    }),
    [formData.password]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name.startsWith("profile.")) {
      const field = name.split(".")[1];
      setFormData((previous) => ({
        ...previous,
        profile: {
          ...previous.profile,
          [field]: value,
        },
      }));
    } else {
      setFormData((previous) => ({
        ...previous,
        [name]: value,
      }));
    }

    if (errors[name]) {
      setErrors((previous) => ({ ...previous, [name]: null }));
    }
    if (formError) {
      setFormError("");
    }
  };

  const validate = () => {
    const validationErrors = {};
    const firstName = formData.profile.firstName.trim();
    const lastName = formData.profile.lastName.trim();
    const email = formData.email.trim();

    if (firstName.length < 2) {
      validationErrors["profile.firstName"] = "First name must be at least 2 characters.";
    }

    if (lastName.length < 2) {
      validationErrors["profile.lastName"] = "Last name must be at least 2 characters.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.email = "Enter a valid email address.";
    }

    if (!passwordChecks.minLength) {
      validationErrors.password = "Password must be at least 8 characters.";
    } else if (!passwordChecks.lowercase || !passwordChecks.uppercase || !passwordChecks.number) {
      validationErrors.password = "Password needs uppercase, lowercase, and a number.";
    }

    if (formData.password !== formData.confirmPassword) {
      validationErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!validate()) {
      return;
    }

    setLoading(true);

    const payload = {
      ...formData,
      email: formData.email.trim().toLowerCase(),
      profile: {
        firstName: formData.profile.firstName.trim(),
        lastName: formData.profile.lastName.trim(),
        phone: formData.profile.phone.trim(),
      },
    };

    delete payload.confirmPassword;

    const result = await register(payload);

    if (!result.success) {
      setFormError(result.error || "Unable to create your account right now.");
      setLoading(false);
      return;
    }

    navigate("/profile/onboarding");
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
              <span className="auth-brand-subtitle">Focused task workspace</span>
            </span>
          </Link>

          <h1 className="auth-title">Create your workspace and start shipping faster</h1>
          <p className="auth-copy">
            Choose your role, complete your profile, and get a workflow tuned for either
            task submission or execution.
          </p>

          <div className="auth-benefits">
            <Feature text="Structured task briefs and progress updates" />
            <Feature text="Role-specific dashboards and permissions" />
            <Feature text="Secure access with refresh-token sessions" />
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <div>
                <p className="auth-kicker">Join TaskNexus</p>
                <h2 className="auth-heading">Create your account</h2>
              </div>
              <Link to="/login" className="btn btn-secondary btn-sm">
                Sign in
              </Link>
            </div>

            {formError && <div id="register-error" role="alert" className="auth-alert">{formError}</div>}

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RoleCard
                  active={formData.role === USER_ROLES.CLIENT}
                  title="I submit tasks"
                  description="Client workspace"
                  icon={<Briefcase className="h-4 w-4" />}
                  onClick={() =>
                    setFormData((previous) => ({ ...previous, role: USER_ROLES.CLIENT }))
                  }
                />
                <RoleCard
                  active={formData.role === USER_ROLES.FREELANCER}
                  title="I deliver tasks"
                  description="Freelancer workspace"
                  icon={<Laptop2 className="h-4 w-4" />}
                  onClick={() =>
                    setFormData((previous) => ({ ...previous, role: USER_ROLES.FREELANCER }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  name="profile.firstName"
                  label="First name"
                  value={formData.profile.firstName}
                  onChange={handleChange}
                  error={errors["profile.firstName"]}
                  placeholder="First name"
                />
                <Field
                  name="profile.lastName"
                  label="Last name"
                  value={formData.profile.lastName}
                  onChange={handleChange}
                  error={errors["profile.lastName"]}
                  placeholder="Last name"
                />
              </div>

              <Field
                name="email"
                type="email"
                label="Work email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="you@company.com"
              />

              <Field
                name="profile.phone"
                type="tel"
                label="Phone (optional)"
                value={formData.profile.phone}
                onChange={handleChange}
                placeholder="+1 555 000 0000"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PasswordField
                  id="password"
                  label="Password"
                  value={formData.password}
                  onChange={handleChange}
                  show={showPassword}
                  setShow={setShowPassword}
                  error={errors.password}
                  placeholder="At least 8 characters"
                />
                <PasswordField
                  id="confirmPassword"
                  label="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  show={showConfirmPassword}
                  setShow={setShowConfirmPassword}
                  error={errors.confirmPassword}
                  placeholder="Repeat password"
                />
              </div>

              <div className="auth-checks">
                <PasswordRule met={passwordChecks.minLength} text="At least 8 characters" />
                <PasswordRule met={passwordChecks.lowercase} text="One lowercase letter" />
                <PasswordRule met={passwordChecks.uppercase} text="One uppercase letter" />
                <PasswordRule met={passwordChecks.number} text="One number" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                <span>{loading ? "Creating account..." : "Create account"}</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

const Feature = ({ text }) => (
  <div className="auth-feature">
    <span className="auth-feature-icon">
      <CheckCircle2 className="h-4 w-4" />
    </span>
    <span>{text}</span>
  </div>
);

const Field = ({ name, label, value, onChange, placeholder, type = "text", error }) => (
  <div>
    <label htmlFor={name} className="label auth-label">
      {label}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      className={`input auth-input ${error ? "input-error" : ""}`}
      placeholder={placeholder}
      autoComplete="off"
    />
    {error && <p className="auth-field-error">{error}</p>}
  </div>
);

const PasswordField = ({ id, label, value, onChange, show, setShow, error, placeholder }) => (
  <div>
    <label htmlFor={id} className="label auth-label">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        name={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        className={`input auth-input pr-11 ${error ? "input-error" : ""}`}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow((valueState) => !valueState)}
        className="auth-input-toggle"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    {error && <p className="auth-field-error">{error}</p>}
  </div>
);

const PasswordRule = ({ met, text }) => (
  <div className={`auth-check ${met ? "is-valid" : ""}`}>
    <span className="auth-check-dot" />
    <span>{text}</span>
  </div>
);

const RoleCard = ({ title, description, icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`auth-role-card ${active ? "is-active" : ""}`}
    aria-pressed={active}
  >
    <span className="auth-role-icon">{icon}</span>
    <span className="auth-role-title">{title}</span>
    <span className="auth-role-desc">{description}</span>
  </button>
);

export default Register;
