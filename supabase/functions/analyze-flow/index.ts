import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      required: ["reference", "why_it_fits"],
      properties: {
        reference: {
          type: "string",
          description:
            "A single Bible passage reference like 'Book Chapter:Verse' or 'Book Chapter:Verse-Verse'. Keep it to 1-4 verses. Use standard book names (Psalm, John, Romans, 1 Corinthians).",
        },
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

type Question = {
  id: string;
  prompt: string;
};

type AnthropicResponse = {
  content: Array<{ type: string; input?: unknown; text?: string }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<span[^>]*class="vn"[^>]*>(\d+)<\/span>/gi, " $1 ")
    .replace(/<\/(p|h\d|div|li|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "\u2019")
    .replace(/&#8216;|&lsquo;/g, "\u2018")
    .replace(/&#8220;|&ldquo;/g, "\u201C")
    .replace(/&#8221;|&rdquo;/g, "\u201D")
    .replace(/&#8212;|&mdash;/g, "\u2014")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

async function fetchVerseText(reference: string): Promise<string | null> {
  const nltKey = Deno.env.get("NLT_API_KEY");
  if (!nltKey) return null;
  try {
    const url = `https://api.nlt.to/api/passages?ref=${encodeURIComponent(reference)}&version=NLT&key=${encodeURIComponent(nltKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("NLT fetch failed", res.status, await res.text());
      return null;
    }
    const html = await res.text();
    const text = stripHtml(html);
    return text || null;
  } catch (err) {
    console.error("NLT fetch error", err);
    return null;
  }
}

function getSupabaseConfig() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!url || !anonKey) {
    throw new Error("Missing Supabase function environment variables.");
  }

  return { url, anonKey };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { sessionId } = (await req.json()) as { sessionId?: string };
    if (!sessionId) {
      return jsonResponse({ error: "Missing sessionId" }, 400);
    }

    const { url, anonKey } = getSupabaseConfig();
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: session, error: sessionError } = await supabase
      .from("flow_sessions")
      .select("id,user_id,responses_json,status,ai_analysis_json,flow_template_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return jsonResponse({ error: "Session not found" }, 404);
    }

    if (session.user_id !== userData.user.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (session.status === "completed" && session.ai_analysis_json) {
      const existing = session.ai_analysis_json as {
        scripture_connection?: { reference?: string; text?: string; why_it_fits?: string };
        [k: string]: unknown;
      };
      const esc = existing.scripture_connection;
      if (esc?.reference && !esc.text) {
        const verseText = await fetchVerseText(esc.reference);
        if (verseText) {
          existing.scripture_connection = {
            reference: esc.reference,
            text: verseText,
            why_it_fits: esc.why_it_fits ?? "",
          };
          await supabase
            .from("flow_sessions")
            .update({ ai_analysis_json: existing })
            .eq("id", session.id);
        }
      }
      return jsonResponse(existing);
    }

    const [{ data: template }, { data: profile }] = await Promise.all([
      supabase
        .from("flow_templates")
        .select("name,questions_json,ai_analysis_guidance")
        .eq("id", session.flow_template_id)
        .single(),
      supabase
        .from("profiles")
        .select("preferred_name,faith_tradition,intention")
        .eq("id", userData.user.id)
        .maybeSingle(),
    ]);

    const questions = (template?.questions_json ?? []) as Question[];
    const responses = (session.responses_json ?? {}) as Record<string, string>;
    const qaText = questions
      .map((q) => {
        const answer = responses[q.id];
        if (!answer || !answer.trim()) return null;
        return `Q: ${q.prompt}\nA: ${answer.trim()}`;
      })
      .filter(Boolean)
      .join("\n\n");

    const systemPrompt = [
      `You are a warm, grounded spiritual companion responding to a ${template?.name ?? "reflection"}.`,
      "Speak directly to the person. Be honest, never saccharine. Avoid cliche.",
      profile?.preferred_name ? `Their name is ${profile.preferred_name}.` : "",
      profile?.faith_tradition ? `Faith tradition: ${profile.faith_tradition}.` : "",
      profile?.intention ? `Their stated intention for this practice: ${profile.intention}.` : "",
      template?.ai_analysis_guidance ?? "",
      "Return ONLY a JSON object that matches the provided schema. No prose outside the JSON.",
    ]
      .filter(Boolean)
      .join("\n");

    const userPrompt = `Here is what they wrote, in order:\n\n${qaText}\n\nWrite the reflection now as the JSON object.`;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    let analysis: unknown = null;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY missing");
    } else {
      try {
        const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
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

        if (!anthropicResponse.ok) {
          const errorText = await anthropicResponse.text();
          console.error("Anthropic error", anthropicResponse.status, errorText);
        } else {
          const json = (await anthropicResponse.json()) as AnthropicResponse;
          const toolUse = json.content.find((item) => item.type === "tool_use");
          if (toolUse?.input) {
            analysis = toolUse.input;
          } else {
            const textBlock = json.content.find((item) => item.type === "text");
            if (textBlock?.text) analysis = JSON.parse(textBlock.text);
          }
        }
      } catch (error) {
        console.error("Analyze failure:", error);
      }
    }

    const finalAnalysis = (analysis ?? FALLBACK) as {
      scripture_connection?: { reference?: string; text?: string; why_it_fits?: string };
      [k: string]: unknown;
    };

    // Ensure scripture_connection has real verse text from NLT (Claude only picks the reference).
    const sc = finalAnalysis.scripture_connection;
    if (sc?.reference && !sc.text) {
      const verseText = await fetchVerseText(sc.reference);
      if (verseText) {
        finalAnalysis.scripture_connection = {
          reference: sc.reference,
          text: verseText,
          why_it_fits: sc.why_it_fits ?? "",
        };
      }
    }
    const { error: updateError } = await supabase
      .from("flow_sessions")
      .update({
        ai_analysis_json: finalAnalysis,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (updateError) {
      console.error("Could not save analysis", updateError);
      return jsonResponse({ error: "Could not save analysis" }, 500);
    }

    return jsonResponse(finalAnalysis);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Reflection failed" }, 500);
  }
});
