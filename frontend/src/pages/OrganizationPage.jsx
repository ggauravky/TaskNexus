import { ArrowUpRight, Building2, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import OpportunityCard from "../components/opportunities/OpportunityCard";
import TeamShell from "../components/teams/TeamShell";
import api from "../services/api";
import { locationLabel } from "../utils/opportunities";

const OrganizationPage = () => {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get(`/organizations/${slug}`).then((response) => {
      if (!active) return;
      const item = response.data.data;
      setData(item);
      document.title = `${item.name} Opportunities | TaskNexus`;
    }).catch(() => active && setData(null)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);
  if (loading) return <TeamShell><div className="flex min-h-[70dvh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" /></div></TeamShell>;
  if (!data) return <TeamShell><main className="mx-auto max-w-3xl px-4 py-24 text-center"><Building2 className="mx-auto h-8 w-8 text-[#62666d]" /><h1 className="mt-4 text-2xl font-semibold">Organization not found</h1><Link to="/opportunities" className="team-button-primary mt-6">Browse Opportunities</Link></main></TeamShell>;
  return <TeamShell><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <header className="grid gap-6 border-b border-[#23252a] pb-8 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="team-avatar h-16 w-16 text-lg">{data.logo_url ? <img src={data.logo_url} alt={`${data.name} logo`} className="h-full w-full rounded-xl object-cover" /> : data.name.slice(0, 2).toUpperCase()}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><p className="team-eyebrow">{data.organization_type}</p>{data.verification_status === "verified" ? <span className="team-chip text-emerald-300">Verified catalog identity</span> : <span className="team-chip">Unverified catalog identity</span>}</div>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{data.name}</h1>
        {data.tagline ? <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8a8f98]">{data.tagline}</p> : null}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#8a8f98]">{data.headquarters ? <span><MapPin className="mr-1 inline h-3.5 w-3.5" />{locationLabel(data.headquarters)}</span> : null}{data.industry ? <span>{data.industry}</span> : null}{data.company_size ? <span>{data.company_size} people</span> : null}{data.website_url ? <a className="text-[#828fff] hover:text-[#b7bdf8]" href={data.website_url} target="_blank" rel="noopener noreferrer">Organization website <ArrowUpRight className="inline h-3.5 w-3.5" /></a> : null}</div>
      </div>
    </header>
    <section className="grid gap-6 border-b border-[#23252a] py-8 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
      <div><h2 className="text-xl font-semibold">About</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#a8adb6]">{data.description || "No additional organization description was published."}</p></div>
      <div><h2 className="text-xl font-semibold">Locations</h2><ul className="mt-4 space-y-2 text-sm text-[#a8adb6]">{data.locations?.length ? data.locations.map((location, index) => <li key={`${locationLabel(location)}-${index}`} className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#828fff]" />{locationLabel(location)}</li>) : <li>No additional operating locations published.</li>}</ul></div>
    </section>
    <section className="mt-8"><h2 className="text-xl font-semibold">Open Opportunities <span className="ml-2 text-sm font-normal text-[#62666d]">{data.active_opportunity_count}</span></h2>{data.opportunities.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.opportunities.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}</div> : <p className="mt-6 rounded-xl border border-dashed border-[#34343a] p-10 text-center text-sm text-[#8a8f98]">No currently open Opportunities.</p>}</section>
  </main></TeamShell>;
};
export default OrganizationPage;
