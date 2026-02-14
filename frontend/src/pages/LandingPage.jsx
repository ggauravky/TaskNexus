import { Link } from 'react-router-dom';
import {
    CheckCircle,
    Shield,
    Zap,
    Users,
    Sparkles,
    Clock,
    LineChart,
    Rocket,
    Star,
    ArrowRight
} from 'lucide-react';

/**
 * Landing Page
 */
const LandingPage = () => {
    return (
        <div className="shell">
            {/* Hero Section */}
            <header className="relative overflow-hidden bg-gradient-to-br from-[#0b1021] via-[#0f172a] to-[#1b1f38] text-white">
                <div className="absolute inset-0 opacity-60 hero-grid" />
                <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-primary-500 blur-3xl opacity-30 animate-float" />
                <div className="absolute right-[-60px] top-20 h-72 w-72 rounded-full bg-accent-500 blur-3xl opacity-25 animate-float" />

                <nav className="container mx-auto px-6 py-6 relative z-10 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shadow-glass">
                            <Sparkles className="w-6 h-6 text-primary-100" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold tracking-tight">TaskNexus</p>
                            <p className="text-xs text-gray-300">Managed task delivery</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Link to="/login" className="btn btn-secondary text-sm">
                            Login
                        </Link>
                        <Link to="/register" className="btn btn-primary text-sm">
                            Get Started
                        </Link>
                    </div>
                </nav>

                <div className="container mx-auto px-6 pb-20 pt-10 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <p className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-wide">
                                Managed delivery • No freelancer wrangling
                            </p>
                            <h1 className="text-5xl lg:text-6xl font-bold leading-tight font-display">
                                Ship work without <span className="text-primary-200">managing</span> work.
                            </h1>
                            <p className="text-lg text-gray-200 max-w-2xl">
                                TaskNexus pairs vetted experts with a QA-first workflow so you submit tasks and receive polished deliverables—on autopilot.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <Link to="/register" className="btn btn-primary btn-lg flex items-center">
                                    Start a task <ArrowRight className="w-4 h-4 ml-2" />
                                </Link>
                                <Link to="/login" className="btn btn-secondary btn-lg">
                                    View dashboards
                                </Link>
                            </div>
                            <div className="flex flex-wrap gap-4 pt-4 text-sm text-gray-300">
                                <Badge icon={<Shield className="w-4 h-4" />} label="QA gated" />
                                <Badge icon={<Clock className="w-4 h-4" />} label="Fast turnaround" />
                                <Badge icon={<Star className="w-4 h-4" />} label="Vetted talent" />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute -inset-6 bg-gradient-to-r from-primary-500/20 via-accent-500/10 to-blue-500/20 blur-3xl rounded-full" />
                            <div className="relative glass border border-white/10 rounded-3xl p-6 shadow-2xl">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-sm text-gray-300">Live Control Center</p>
                                        <h3 className="text-2xl font-bold">Real-time delivery</h3>
                                    </div>
                                    <span className="pill bg-white/20 border-white/30 text-white">
                                        Admin & Client view
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <Stat title="Tasks closed" value="2,318" trend="+12.4%" />
                                    <Stat title="Avg. turnaround" value="48h" trend="-6h" positive />
                                    <Stat title="On-time rate" value="98.2%" trend="+1.1%" />
                                    <Stat title="NPS" value="67" trend="+4" />
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { title: 'Landing page redesign', owner: 'Client · SaaS', status: 'QA review' },
                                        { title: 'Data pipeline patch', owner: 'Client · Fintech', status: 'In progress' },
                                        { title: 'Marketing explainer', owner: 'Client · DTC', status: 'Delivered' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{item.title}</p>
                                                <p className="text-xs text-gray-300">{item.owner}</p>
                                            </div>
                                            <StatusPill status={item.status} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Trust & Metrics */}
            <section className="bg-white py-14">
                <div className="container mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-6 text-center">
                        <Metric title="2k+" subtitle="Tasks shipped" />
                        <Metric title="350+" subtitle="Expert freelancers" />
                        <Metric title="48h" subtitle="Median turnaround" />
                        <Metric title="99.2%" subtitle="Client satisfaction" />
                    </div>
                </div>
            </section>

            {/* Why Section */}
            <section className="py-20 bg-gradient-to-br from-white via-white to-primary-50">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-12">
                        <p className="pill mx-auto">Platform advantage</p>
                        <h2 className="text-4xl font-display font-bold mt-4">Why TaskNexus works better</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto mt-3">
                            A fully managed pipeline from brief to delivery, built to eliminate coordination overhead and quality risk.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FeatureCard
                            icon={<CheckCircle className="w-10 h-10 text-primary-600" />}
                            title="Zero coordination"
                            description="Submit tasks, we assign, manage, QA, and deliver. No micromanaging."
                        />
                        <FeatureCard
                            icon={<Shield className="w-10 h-10 text-primary-600" />}
                            title="QA every time"
                            description="Dual QA gates with automated checks plus human review before delivery."
                        />
                        <FeatureCard
                            icon={<Zap className="w-10 h-10 text-primary-600" />}
                            title="Speed as default"
                            description="Smart routing to the fastest qualified freelancer plus SLAs on delivery."
                        />
                        <FeatureCard
                            icon={<Users className="w-10 h-10 text-primary-600" />}
                            title="Vetted network"
                            description="Curated specialists with live performance scoring and reliability signals."
                        />
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-12">
                        <p className="pill mx-auto">Execution flow</p>
                        <h2 className="text-4xl font-display font-bold mt-3">From brief to delivered in three moves</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        <StepCard
                            number="01"
                            title="Submit your brief"
                            description="Drop context, budget, and deadline. We structure requirements automatically."
                        />
                        <StepCard
                            number="02"
                            title="We manage delivery"
                            description="We staff, schedule, and QA. You watch live status—no extra meetings."
                        />
                        <StepCard
                            number="03"
                            title="Receive polished output"
                            description="Download-ready deliverables with revision loops baked in."
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 bg-gradient-to-r from-primary-600 via-primary-700 to-accent-600 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 hero-grid" />
                <div className="container mx-auto px-6 relative">
                    <div className="grid md:grid-cols-2 gap-10 items-center">
                        <div>
                            <p className="pill bg-white/15 border-white/30 text-white">Start today</p>
                            <h3 className="text-3xl md:text-4xl font-display font-bold mt-4 leading-tight">
                                Ready to outsource without the hassle?
                            </h3>
                            <p className="text-primary-100 mt-3 text-lg">
                                Join teams who use TaskNexus for design, dev, data, content, and everything in between.
                            </p>
                            <div className="flex gap-3 mt-6">
                                <Link to="/register" className="btn btn-secondary bg-white text-primary-700">
                                    Get started free
                                </Link>
                                <Link to="/admin/login" className="btn btn-primary">
                                    Admin portal
                                </Link>
                            </div>
                        </div>
                        <div className="glass border-white/20 rounded-2xl p-6 shadow-glass">
                            <h4 className="text-lg font-semibold mb-3">What you get</h4>
                            <ul className="space-y-3 text-sm text-primary-50">
                                <li className="flex items-start">
                                    <Sparkles className="w-5 h-5 mr-3 text-white" />
                                    Managed tasks with live dashboards for clients, freelancers, and admins.
                                </li>
                                <li className="flex items-start">
                                    <LineChart className="w-5 h-5 mr-3 text-white" />
                                    Performance analytics and SLA visibility across every engagement.
                                </li>
                                <li className="flex items-start">
                                    <Rocket className="w-5 h-5 mr-3 text-white" />
                                    Fast onboarding—spin up your first task in minutes.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#0b1021] text-gray-300 py-10">
                <div className="container mx-auto px-6 text-center space-y-2">
                    <p className="text-white font-semibold">TaskNexus</p>
                    <p className="text-sm text-gray-400">Managed task delivery with production-grade quality control.</p>
                    <div className="flex justify-center gap-4 text-xs text-gray-500 pt-3">
                        <Link to="/admin/login" className="hover:text-white transition-colors">Admin Portal</Link>
                        <span>•</span>
                        <Link to="/login" className="hover:text-white transition-colors">User Login</Link>
                    </div>
                    <p className="text-xs text-gray-500">© 2026 TaskNexus. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

const Badge = ({ icon, label }) => (
    <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs">
        {icon}
        {label}
    </span>
);

const StatusPill = ({ status }) => {
    const map = {
        'QA review': 'bg-amber-500/20 text-amber-200 border border-amber-200/30',
        'In progress': 'bg-primary-500/20 text-primary-100 border border-primary-200/40',
        Delivered: 'bg-green-500/20 text-green-100 border border-green-200/30'
    };
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-white/10'}`}>{status}</span>;
};

/**
 * Feature Card Component
 */
const FeatureCard = ({ icon, title, description }) => {
    return (
        <div className="card shadow-soft hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-xl bg-primary-50 text-primary-600">{icon}</div>
                <h3 className="text-xl font-semibold">{title}</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">{description}</p>
        </div>
    );
};

/**
 * Step Card Component
 */
const StepCard = ({ number, title, description }) => {
    return (
        <div className="section p-6 shadow-soft hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary-100 text-primary-700 font-bold">
                    {number}
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
            </div>
            <p className="text-gray-600">{description}</p>
        </div>
    );
};

const Stat = ({ title, value, trend, positive = true }) => (
    <div className="p-4 rounded-2xl bg-white/10 border border-white/20">
        <p className="text-sm text-gray-200">{title}</p>
        <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl font-bold text-white">{value}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${positive ? 'bg-green-500/20 text-green-100' : 'bg-amber-500/20 text-amber-100'}`}>
                {trend}
            </span>
        </div>
    </div>
);

const Metric = ({ title, subtitle }) => (
    <div className="section p-6 shadow-soft">
        <p className="text-3xl font-bold text-gray-900">{title}</p>
        <p className="text-gray-500 mt-1">{subtitle}</p>
    </div>
);

export default LandingPage;
