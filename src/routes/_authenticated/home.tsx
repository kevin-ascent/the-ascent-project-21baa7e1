import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mountain, LogOut, ArrowRight } from "lucide-react";
import { FlowIcon } from "@/lib/flow-icon";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — The Ascent" }] }),
  component: Home,
});

type Template = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
};

type Session = {
  id: string;
  title: string | null;
  status: string;
  updated_at: string;
  completed_at: string | null;
  flow_template_id: string;
  flow_templates: { name: string; icon: string | null; slug: string } | null;
};

function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const [profileRes, tplRes, sessRes] = await Promise.all([
        supabase.from("profiles").select("preferred_name").eq("id", userData.user.id).maybeSingle(),
        supabase
          .from("flow_templates")
          .select("id,slug,name,description,icon,color,display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("flow_sessions")
          .select("id,title,status,updated_at,completed_at,flow_template_id,flow_templates(name,icon,slug)")
          .order("updated_at", { ascending: false })
          .limit(20),
      ]);

      if (tplRes.error) {
        console.error("[home] flow_templates fetch error", tplRes.error);
      } else {
        console.log(
          "[home] flow_templates fetched",
          (tplRes.data ?? []).length,
          (tplRes.data ?? []).map((template) => template.slug),
        );
      }

      if (!profileRes.data?.preferred_name) {
        navigate({ to: "/onboarding" });
        return;
      }
      setName(profileRes.data.preferred_name);
      setTemplates((tplRes.data ?? []) as Template[]);
      setSessions((sessRes.data ?? []) as Session[]);
      setLoading(false);
    })();
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const inProgress = sessions.filter((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 py-5 flex items-center justify-between max-w-3xl mx-auto">
        <Link to="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Mountain className="h-4 w-4" /> The Ascent
        </Link>
        <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-20">
        <h1 className="font-display text-4xl md:text-5xl tracking-tight mt-6">
          Hello, {name}.
        </h1>
        <p className="mt-2 text-muted-foreground">What kind of reflection today?</p>

        {inProgress.length > 0 && (
          <section className="mt-8 rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Continue where you left off</p>
            <div className="mt-3 space-y-2">
              {inProgress.map((s) => (
                <Link
                  key={s.id}
                  to="/flow/$slug"
                  params={{ slug: s.flow_templates?.slug ?? "" }}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-secondary transition"
                >
                  <span className="text-sm">
                    <FlowIcon name={s.flow_templates?.icon} className="mr-2 inline h-4 w-4" />

                    {s.title || s.flow_templates?.name}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <Link
              key={t.id}
              to="/flow/$slug"
              params={{ slug: t.slug }}
              className="group rounded-lg border border-border bg-card p-6 hover:border-primary/60 transition"
            >
              <div className="text-3xl">{t.icon}</div>
              <h2 className="mt-4 font-display text-2xl">{t.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-primary group-hover:gap-2 transition-all">
                Begin <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-12">
          <h3 className="font-display text-xl">Your reflections</h3>
          {completed.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No completed reflections yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border border border-border rounded-lg">
              {completed.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/session/$id"
                    params={{ id: s.id }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-secondary transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">
                        <span className="mr-2">{s.flow_templates?.icon}</span>
                        {s.title || s.flow_templates?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.completed_at ? new Date(s.completed_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
