import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mountain, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { analyzeFlow } from "@/lib/analyze-flow.functions";

export const Route = createFileRoute("/_authenticated/flow/$slug")({
  head: () => ({ meta: [{ title: "Reflect — The Ascent" }] }),
  component: FlowRunner,
});

type Question = {
  id: string;
  type: "text" | "textarea" | "select";
  prompt: string;
  required?: boolean;
  options?: string[];
  interpolation_key?: string;
  show_if?: { question_id: string; not_empty?: boolean };
};

type Template = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  questions_json: Question[];
};

function interpolate(prompt: string, responses: Record<string, string>) {
  return prompt.replace(/\{(\w+)\}/g, (_, key) => responses[key] ?? "");
}

function FlowRunner() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeFlow);

  const [template, setTemplate] = useState<Template | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: tpl, error: tplErr } = await supabase
        .from("flow_templates")
        .select("id,name,slug,icon,questions_json")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (tplErr || !tpl) {
        toast.error("Flow not found");
        navigate({ to: "/home" });
        return;
      }
      const t = tpl as unknown as Template;
      setTemplate(t);

      const { data: existing } = await supabase
        .from("flow_sessions")
        .select("id,responses_json")
        .eq("user_id", userData.user.id)
        .eq("flow_template_id", t.id)
        .eq("status", "in_progress")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setSessionId(existing.id);
        const r = (existing.responses_json ?? {}) as Record<string, string>;
        setResponses(r);
        // jump to first unanswered
        const firstUnanswered = t.questions_json.findIndex((q) => !r[q.id]);
        setIndex(firstUnanswered === -1 ? t.questions_json.length - 1 : firstUnanswered);
      } else {
        const { data: created, error: cErr } = await supabase
          .from("flow_sessions")
          .insert({
            user_id: userData.user.id,
            flow_template_id: t.id,
            responses_json: {},
            status: "in_progress",
          })
          .select("id")
          .single();
        if (cErr || !created) {
          toast.error("Could not start session");
          return;
        }
        setSessionId(created.id);
      }
      setLoading(false);
    })();
  }, [slug, navigate]);

  const visibleQuestions = useMemo(() => {
    if (!template) return [];
    return template.questions_json.filter((q) => {
      if (!q.show_if) return true;
      const target = responses[q.show_if.question_id];
      if (q.show_if.not_empty) return target && target.trim().length > 0;
      return true;
    });
  }, [template, responses]);

  if (loading || !template) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const safeIndex = Math.min(index, visibleQuestions.length - 1);
  const q = visibleQuestions[safeIndex];
  const value = responses[q.id] ?? "";
  const isLast = safeIndex === visibleQuestions.length - 1;
  const canContinue = !q.required || (value && value.trim().length > 0);

  async function saveAnswer(nextResponses: Record<string, string>) {
    if (!sessionId || !template) return;
    setSaving(true);
    const payload: Record<string, unknown> = { responses_json: nextResponses };
    // title from first answer
    const firstQ = template.questions_json[0];
    if (firstQ && nextResponses[firstQ.id]) {
      payload.title = nextResponses[firstQ.id].slice(0, 80);
    }
    await supabase.from("flow_sessions").update(payload).eq("id", sessionId);
    setSaving(false);
  }

  async function handleContinue() {
    const next = { ...responses, [q.id]: value };
    setResponses(next);
    await saveAnswer(next);
    if (isLast) {
      if (!sessionId) return;
      setFinishing(true);
      try {
        await analyze({ data: { sessionId } });
        navigate({ to: "/session/$id", params: { id: sessionId } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Reflection failed");
        setFinishing(false);
      }
    } else {
      setIndex(safeIndex + 1);
    }
  }

  function handleChange(v: string) {
    setResponses({ ...responses, [q.id]: v });
  }

  if (finishing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <Mountain className="h-10 w-10 text-primary animate-pulse" />
        <p className="mt-6 font-display text-2xl">Reflecting…</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Reading what you wrote and preparing a response.
        </p>
      </div>
    );
  }

  const prompt = interpolate(q.prompt, responses);
  const progress = ((safeIndex + 1) / visibleQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-2xl mx-auto w-full">
        <Link to="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <span className="text-xs text-muted-foreground">
          {template.icon} {template.name} · {safeIndex + 1} / {visibleQuestions.length}
        </span>
      </header>

      <div className="h-0.5 bg-border">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <main className="flex-1 flex items-center px-6 py-12 max-w-2xl mx-auto w-full">
        <div className="w-full">
          <h1 className="font-display text-2xl md:text-3xl leading-snug">{prompt}</h1>

          <div className="mt-8">
            {q.type === "text" && (
              <Input value={value} onChange={(e) => handleChange(e.target.value)} autoFocus />
            )}
            {q.type === "textarea" && (
              <Textarea
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                rows={6}
                autoFocus
                className="text-base leading-relaxed"
              />
            )}
            {q.type === "select" && (
              <select
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">Choose…</option>
                {q.options?.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setIndex(Math.max(0, safeIndex - 1))}
              disabled={safeIndex === 0}
            >
              Back
            </Button>
            <Button onClick={handleContinue} disabled={!canContinue || saving}>
              {isLast ? "Finish & reflect" : "Continue"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
