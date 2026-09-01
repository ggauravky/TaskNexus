import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  MessageSquare,
  ShieldCheck,
  Users2,
} from "lucide-react";
import PublicNavigation from "../components/marketing/PublicNavigation";
import PublicFooter from "../components/marketing/PublicFooter";

const capabilities = [
  {
    icon: MessageSquare,
    title: "Keep context with the task",
    copy: "Briefs, comments, attachments, milestones, and activity stay connected to the work they describe.",
    className: "md:col-span-2",
  },
  {
    icon: Users2,
    title: "Role-aware workspaces",
    copy: "Clients, freelancers, and administrators see the controls and information relevant to their responsibilities.",
  },
  {
    icon: Bell,
    title: "Visible changes",
    copy: "Status updates and realtime events help active work stay current without relying on scattered messages.",
  },
];

const faqs = [
  {
    question: "What can I do in TaskNexus today?",
    answer: "Clients can create and monitor tasks. Freelancers can manage assigned work, progress, and collaboration. Administrators review platform activity.",
  },
  {
    question: "Is TaskNexus already a team and project network?",
    answer: "Not yet. Team creation, project spaces, people discovery, and contribution proof are part of the planned product direction, not current features.",
  },
  {
    question: "Who can create an account?",
    answer: "Public registration is available for client and freelancer accounts. Administrator access is provisioned separately through a controlled process.",
  },
  {
    question: "Does TaskNexus process real payments?",
    answer: "No. Current payment-related views are workflow records only. A production payment gateway is not part of the current release.",
  },
];

const LandingPage = () => (
  <div className="min-h-screen bg-[#010102] text-[#f7f8f8]">
    <header className="border-b border-white/10">
      <PublicNavigation dark />
    </header>

    <main>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-primary-300">Focused work, clearly tracked</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.06] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Organize the work. Keep progress visible.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
              TaskNexus gives clients and freelancers one focused place to brief, track, discuss, and deliver work.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300">
                Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-300">
                Sign in
              </Link>
            </div>
          </div>

          <WorkspacePreview />
        </div>
      </section>

      <section className="border-b border-white/10 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">A calmer place to move work forward</h2>
            <p className="mt-4 text-base leading-7 text-slate-400">Current capabilities focus on task clarity, accountable progress, and collaboration around delivery.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {capabilities.map(({ icon: Icon, title, copy, className = "" }, index) => (
              <article key={title} className={`rounded-xl border border-white/10 bg-[#0f1011] p-6 ${className} ${index === 0 ? "md:grid md:grid-cols-[auto_1fr] md:items-start md:gap-5" : ""}`}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary-400/20 bg-primary-500/10 text-primary-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className={index === 0 ? "mt-4 md:mt-0" : "mt-5"}>
                  <h3 className="text-lg font-medium text-white">{title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">From a clear brief to visible delivery</h2>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <FlowItem icon={CircleDashed} title="Define" copy="Create the task with its scope, budget, deadline, and required skills." />
            <FlowItem icon={Clock3} title="Track" copy="Follow assignment, progress, milestones, comments, and important status changes." />
            <FlowItem icon={CheckCircle2} title="Review" copy="Keep submitted work and delivery decisions connected to the original task." />
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Trust comes from honest boundaries</h2>
            <p className="mt-4 text-base leading-7 text-slate-400">TaskNexus is being prepared for broader collaboration features. This release only describes what the product supports now.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TrustItem icon={ShieldCheck} title="Controlled access" copy="Public users can create client or freelancer accounts. Admin access is provisioned separately." />
            <TrustItem icon={Check} title="Real product claims" copy="No fabricated user counts, delivery rates, talent claims, or growth percentages." />
            <TrustItem icon={MessageSquare} title="Work-centered context" copy="Discussion and attachments remain connected to authorized task participants." />
            <TrustItem icon={Users2} title="A clear direction" copy="Future team and project capabilities will appear only when they are actually available." />
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Questions, answered plainly</h2>
          <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {faqs.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                  {item.question}
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <p className="mt-3 max-w-2xl pr-8 text-sm leading-6 text-slate-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-white/10 bg-[#0f1011] px-6 py-10 sm:px-10 sm:py-12">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em]">Start with clearer work today</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">Create a client or freelancer account and use the task workspace that exists now.</p>
            <Link to="/register" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-300">
              Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>

    <PublicFooter />
  </div>
);

const WorkspacePreview = () => (
  <div className="relative rounded-2xl border border-white/10 bg-[#0f1011] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
    <div className="rounded-xl border border-white/10 bg-[#141516]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">Task workspace</p>
          <p className="mt-0.5 text-xs text-slate-500">Interface preview using current capabilities</p>
        </div>
        <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-200">In progress</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_0.72fr]">
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-[#0f1011] p-4">
            <p className="text-xs font-medium text-slate-500">Current task</p>
            <h2 className="mt-2 text-lg font-medium text-white">Prepare the product onboarding page</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Scope, milestones, and discussion stay together so the next action is clear.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0f1011] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">Milestones</span>
              <span className="text-slate-500">2 of 3 complete</span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <PreviewRow complete label="Confirm page structure" />
              <PreviewRow complete label="Build responsive layout" />
              <PreviewRow label="Review content and accessibility" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#0f1011] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <MessageSquare className="h-4 w-4 text-primary-300" aria-hidden="true" />
            Latest update
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">The responsive pass is ready. I attached the review notes and marked the layout milestone complete.</p>
          <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-500">Attachment access is limited to task participants.</div>
        </div>
      </div>
    </div>
  </div>
);

const PreviewRow = ({ label, complete = false }) => (
  <div className="flex items-center gap-3 text-slate-300">
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${complete ? "border-primary-400/30 bg-primary-500/15 text-primary-300" : "border-white/15 text-transparent"}`}>
      <Check className="h-3 w-3" aria-hidden="true" />
    </span>
    <span className={complete ? "text-slate-500 line-through" : ""}>{label}</span>
  </div>
);

const FlowItem = ({ icon: Icon, title, copy }) => (
  <article className="border-l border-white/10 pl-5">
    <Icon className="h-5 w-5 text-primary-300" aria-hidden="true" />
    <h3 className="mt-5 text-xl font-medium text-white">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
  </article>
);

const TrustItem = ({ icon: Icon, title, copy }) => (
  <article className="rounded-xl border border-white/10 bg-[#0f1011] p-5">
    <Icon className="h-5 w-5 text-primary-300" aria-hidden="true" />
    <h3 className="mt-4 font-medium text-white">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
  </article>
);

export default LandingPage;
