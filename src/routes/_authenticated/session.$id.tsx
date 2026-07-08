import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mountain, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/session/$id")({
  head: () => ({ meta: [{ title: "Reflection — The Ascent" }] }),
  component: SessionResults,
});

type Analysis = {
  headline: string;
  affirmation: string;
  insight: string;
  scripture_connection: { reference: string; text: string; why_it_fits: string };
  themes: string[];
  reflective_question: string;
  suggested_action: string;
};

type SessionRow = {
  id: string;
  title: string | null;
  responses_json: Record<string, string>;
  ai_analysis_json: Analysis | null;
  status: string;
  completed_at: string | null;
  flow_templates: { name: string; icon: string | null; questions_json: { id: string; prompt: string }[] } | null;
};

function SessionResults() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("flow_sessions")
        .select("id,title,responses_json,ai_analysis_json,status,completed_at,flow_templates(name,icon,questions_json)")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast.error("Reflection not found");
        navigate({ to: "/home" });
        return;
      }
      const row = data as unknown as SessionRow;
      setSession(row);
      setLoading(false);

      // Backfill missing scripture verse text for older sessions.
      const sc = row.ai_analysis_json?.scripture_connection;
      if (sc?.reference && !sc.text) {
        const { data: refreshed } = await supabase.functions.invoke("analyze-flow", {
          body: { sessionId: id },
        });
        if (refreshed && typeof refreshed === "object" && "scripture_connection" in refreshed) {
          setSession({ ...row, ai_analysis_json: refreshed as Analysis });
        }
      }
    })();
  }, [id, navigate]);

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const a = session.ai_analysis_json;
  const questions = session.flow_templates?.questions_json ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 py-5 flex items-center justify-between max-w-2xl mx-auto">
        <Link to="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <span className="text-xs text-muted-foreground">
          {session.flow_templates?.icon} {session.flow_templates?.name}
        </span>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-20">
        {a ? (
          <article className="space-y-8">
            <div className="flex items-center gap-2 text-primary text-sm">
              <Sparkles className="h-4 w-4" /> A reflection for you
            </div>
            <h1 className="font-display text-3xl md:text-4xl leading-tight tracking-tight">{a.headline}</h1>

            <p className="text-lg leading-relaxed text-foreground/90 italic">{a.affirmation}</p>

            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Insight</h2>
              <p className="mt-2 text-base leading-relaxed">{a.insight}</p>
            </section>

            {a.scripture_connection && (
              <section className="rounded-lg border border-primary/30 bg-primary/5 p-5">
                <h2 className="text-xs uppercase tracking-wider text-primary">Scripture</h2>
                <p className="mt-2 font-display text-lg italic leading-relaxed">"{a.scripture_connection.text}"</p>
                <p className="mt-2 text-sm text-muted-foreground">— {a.scripture_connection.reference}</p>
                <p className="mt-3 text-sm leading-relaxed">{a.scripture_connection.why_it_fits}</p>
              </section>
            )}

            {a.themes?.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Themes</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.themes.map((t) => (
                    <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs">{t}</span>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Sit with this</h2>
              <p className="mt-2 font-display text-xl leading-snug">{a.reflective_question}</p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground">One step</h2>
              <p className="mt-2 text-base leading-relaxed">{a.suggested_action}</p>
            </section>

            <div className="flex gap-3 pt-6">
              <Button asChild variant="outline">
                <Link to="/home">Back to home</Link>
              </Button>
              <Button asChild>
                <Link to="/home">Start another</Link>
              </Button>
            </div>
          </article>
        ) : (
          <div className="mt-10 text-center text-muted-foreground">
            <Mountain className="h-8 w-8 mx-auto" />
            <p className="mt-4">This reflection hasn't been analyzed yet.</p>
          </div>
        )}

        <details className="mt-12 border-t border-border pt-6">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            View your answers
          </summary>
          <div className="mt-4 space-y-4">
            {questions.map((q) => {
              const ans = session.responses_json?.[q.id];
              if (!ans) return null;
              return (
                <div key={q.id}>
                  <p className="text-xs text-muted-foreground">{q.prompt}</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{ans}</p>
                </div>
              );
            })}
          </div>
        </details>
      </main>
    </div>
  );
}
