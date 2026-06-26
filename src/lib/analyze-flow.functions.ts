import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({ sessionId: z.string().uuid() });

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "affirmation",
    "insight",
    "scripture_connection",
    "themes",
    "reflective_question",
    "suggested_action",
  ],
  properties: {
    headline: { type: "string" },
    affirmation: { type: "string" },
    insight: { type: "string" },
    scripture_connection: {
      type: "object",
      additionalProperties: false,
      required: ["reference", "text", "why_it_fits"],
      properties: {
        reference: { type: "string" },
        text: { type: "string" },
        why_it_fits: { type: "string" },
      },
    },
    themes: { type: "array", items: { type: "string" } },
    reflective_question: { type: "string" },
    suggested_action: { type: "string" },
  },
};

const FALLBACK = {
  headline: "Thank you for showing up.",
  affirmation:
    "Reflecting honestly is itself an act of faith. The fact that you sat down and wrote matters.",
  insight:
    "We couldn't generate a full reflection right now, but your answers are saved. Try again in a moment, or revisit what you wrote.",
  scripture_connection: {
    reference: "Psalm 46:10",
    text: "Be still, and know that I am God.",
    why_it_fits: "A reminder that presence comes before performance.",
  },
  themes: ["presence"],
  reflective_question: "What did writing this surface that you weren't expecting?",
  suggested_action: "Re-read your own answers slowly once before moving on with your day.",
};

export const analyzeFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("flow_sessions")
      .select("id,user_id,responses_json,status,ai_analysis_json,flow_template_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr || !session) throw new Error("Session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");

    // Idempotent: return existing analysis
    if (session.status === "completed" && session.ai_analysis_json) {
      return session.ai_analysis_json;
    }

    const { data: template } = await supabase
      .from("flow_templates")
      .select("name,slug,questions_json,ai_analysis_guidance")
      .eq("id", session.flow_template_id)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_name,faith_tradition,intention")
      .eq("id", userId)
      .maybeSingle();

    const questions = (template?.questions_json ?? []) as { id: string; prompt: string }[];
    const responses = (session.responses_json ?? {}) as Record<string, string>;

    const qaText = questions
      .map((q) => {
        const ans = responses[q.id];
        if (!ans || !ans.trim()) return null;
        return `Q: ${q.prompt}\nA: ${ans.trim()}`;
      })
      .filter(Boolean)
      .join("\n\n");

    const systemPrompt = [
      `You are a warm, grounded spiritual companion responding to a ${template?.name ?? "reflection"}.`,
      `Speak directly to the person. Be honest, never saccharine. Avoid cliché.`,
      profile?.preferred_name ? `Their name is ${profile.preferred_name}.` : "",
      profile?.faith_tradition ? `Faith tradition: ${profile.faith_tradition}.` : "",
      profile?.intention ? `Their stated intention for this practice: ${profile.intention}.` : "",
      template?.ai_analysis_guidance ?? "",
      `Return ONLY a JSON object that matches the provided schema. No prose outside the JSON.`,
    ]
      .filter(Boolean)
      .join("\n");

    const userPrompt = `Here is what they wrote, in order:\n\n${qaText}\n\nWrite the reflection now as the JSON object.`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY missing");
      await supabase
        .from("flow_sessions")
        .update({
          ai_analysis_json: FALLBACK,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", session.id);
      return FALLBACK;
    }

    let analysis: unknown = null;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          tools: [
            {
              name: "return_reflection",
              description: "Return the structured reflection",
              input_schema: ANALYSIS_SCHEMA,
            },
          ],
          tool_choice: { type: "tool", name: "return_reflection" },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Anthropic error", res.status, errText);
        throw new Error(`Anthropic ${res.status}`);
      }

      const json = (await res.json()) as {
        content: Array<{ type: string; input?: unknown; text?: string }>;
      };
      const toolUse = json.content.find((c) => c.type === "tool_use");
      if (toolUse?.input) {
        analysis = toolUse.input;
      } else {
        const textBlock = json.content.find((c) => c.type === "text");
        if (textBlock?.text) analysis = JSON.parse(textBlock.text);
      }
    } catch (err) {
      console.error("Analyze failure:", err);
    }

    const finalAnalysis = analysis ?? FALLBACK;

    await supabase
      .from("flow_sessions")
      .update({
        ai_analysis_json: finalAnalysis as never,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    return finalAnalysis;
  });
