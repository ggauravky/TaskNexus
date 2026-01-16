import { Link } from 'react-router-dom';
import { CheckCircle, Shield, Zap, Users } from 'lucide-react';

/**
 * Landing Page
 */
const LandingPage = () => {
    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <header className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
                <nav className="container mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div className="text-2xl font-bold">TaskNexus</div>
                        <div className="space-x-4">
                            <Link to="/login" className="hover:text-primary-200 transition">
                                Login
                            </Link>
                            <Link
                                to="/register"
                                className="bg-white text-primary-600 px-6 py-2 rounded-lg hover:bg-gray-100 transition"
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </nav>

                <div className="container mx-auto px-6 py-20 text-center">
                    <h1 className="text-5xl font-bold mb-6">
                        Submit Tasks. Receive Deliverables.
                    </h1>
                    <p className="text-xl mb-8 text-primary-100 max-w-2xl mx-auto">
                        The managed task outsourcing platform where you get final deliverables
                        without managing freelancers. We handle everything.
                    </p>
                    <Link
                        to="/register"
                        className="inline-block bg-white text-primary-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition"
                    >
                        Start Your First Task
                    </Link>
                </div>
            </header>

            {/* Features Section */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center mb-12">
                        Why TaskNexus?
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <FeatureCard
                            icon={<CheckCircle className="w-12 h-12 text-primary-600" />}
                            title="Zero Coordination"
                            description="No freelancer management. Just submit your task and receive deliverables."
                        />
                        <FeatureCard
                            icon={<Shield className="w-12 h-12 text-primary-600" />}
                            title="Quality Guaranteed"
                            description="Every task goes through our QA process before delivery to you."
                        />
                        <FeatureCard
                            icon={<Zap className="w-12 h-12 text-primary-600" />}
                            title="Fast Turnaround"
                            description="Smart assignment algorithm ensures tasks are completed on time."
                        />
                        <FeatureCard
                            icon={<Users className="w-12 h-12 text-primary-600" />}
                            title="Vetted Talent"
                            description="Work with pre-screened freelancers managed by our platform."
                        />
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 bg-gray-50">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center mb-12">
                        How It Works
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        <StepCard
                            number="1"
                            title="Submit Your Task"
                            description="Tell us what you need done, set your budget and deadline."
                        />
                        <StepCard
                            number="2"
                            title="We Handle It"
                            description="We assign, manage, and quality-check everything."
                        />
                        <StepCard
                            number="3"
                            title="Receive Deliverable"
                            description="Get your completed work. Request revisions if needed."
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-primary-600 text-white">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold mb-6">
                        Ready to outsource without the hassle?
                    </h2>
                    <p className="text-xl mb-8 text-primary-100">
                        Join hundreds of clients who trust TaskNexus with their tasks
                    </p>
                    <Link
                        to="/register"
                        className="inline-block bg-white text-primary-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition"
                    >
                        Get Started Free
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-8">
                <div className="container mx-auto px-6 text-center">
                    <p>&copy; 2026 TaskNexus. All rights reserved.</p>
                    <p className="mt-2 text-sm">Built with production-grade architecture</p>
                    <div className="mt-4 pt-4 border-t border-gray-800">
                        <Link
                            to="/admin/login"
                            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            Admin Portal
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

/**
 * Feature Card Component
 */
const FeatureCard = ({ icon, title, description }) => {
    return (
        <div className="text-center">
            <div className="flex justify-center mb-4">{icon}</div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-600">{description}</p>
        </div>
    );
};

/**
 * Step Card Component
 */
const StepCard = ({ number, title, description }) => {
    return (
        <div className="text-center">
            <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {number}
            </div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-600">{description}</p>
        </div>
    );
};

export default LandingPage;
