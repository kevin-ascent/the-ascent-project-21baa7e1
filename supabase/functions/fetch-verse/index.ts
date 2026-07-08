import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reference", "why_it_fits"],
  properties: {
    reference: {
      type: "string",
      description:
        "A single Bible passage reference in the format 'Book Chapter:Verse' or 'Book Chapter:Verse-Verse'. Keep it short — 1 to 4 verses. Use a standard book name (e.g. Psalm, John, Romans, 1 Corinthians).",
    },
    why_it_fits: { type: "string" },
  },
};

type Question = { id: string; prompt: string };

type AnthropicResponse = {
  content: Array<{ type: string; input?: unknown; text?: string }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function stripHtml(html: string): string {
  return html
    // drop scripts/styles
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    // NLT wraps verse numbers in <span class="vn">1</span> — keep the number with a space
    .replace(/<span[^>]*class="vn"[^>]*>(\d+)<\/span>/gi, " $1 ")
    // paragraph/line breaks -> newline
    .replace(/<\/(p|h\d|div|li|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // remove all remaining tags
    .replace(/<[^>]+>/g, "")
    // decode a few common entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "\u2019")
    .replace(/&#8216;|&lsquo;/g, "\u2018")
    .replace(/&#8220;|&ldquo;/g, "\u201C")
    .replace(/&#8221;|&rdquo;/g, "\u201D")
    .replace(/&#8212;|&mdash;/g, "\u2014")
    // collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const { sessionId } = (await req.json()) as { sessionId?: string };
    if (!sessionId) return jsonResponse({ error: "Missing sessionId" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!url || !anonKey) return jsonResponse({ error: "Server not configured" }, 500);

    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: session, error: sessionErr } = await supabase
      .from("flow_sessions")
      .select("id,user_id,responses_json,flow_template_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionErr || !session) return jsonResponse({ error: "Session not found" }, 404);
    if (session.user_id !== userData.user.id) return jsonResponse({ error: "Forbidden" }, 403);

    const { data: template } = await supabase
      .from("flow_templates")
      .select("name,slug,questions_json")
      .eq("id", session.flow_template_id)
      .single();

    const questions = (template?.questions_json ?? []) as Question[];
    const responses = (session.responses_json ?? {}) as Record<string, string>;
    const qaText = questions
      .map((q) => {
        const a = responses[q.id];
        if (!a || !a.trim()) return null;
        return `Q: ${q.prompt}\nA: ${a.trim()}`;
      })
      .filter(Boolean)
      .join("\n\n");

    // 1) Ask Claude to pick a single, relevant Scripture reference.
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return jsonResponse({ error: "ANTHROPIC_API_KEY missing" }, 500);

    const systemPrompt = [
      `You are choosing a single Bible verse that speaks directly to what a person just wrote during a ${template?.name ?? "reflection"}.`,
      "Pick a specific, well-known passage that fits the heart of what they shared — not a generic verse.",
      "Prefer 1-4 verses. Return only the reference and a short reason. Use standard book names.",
    ].join("\n");

    const userPrompt = `Here is what they wrote:\n\n${qaText}\n\nChoose one passage.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "return_verse",
            description: "Return the chosen Bible reference",
            input_schema: VERSE_SCHEMA,
          },
        ],
        tool_choice: { type: "tool", name: "return_verse" },
      }),
    });

    if (!claudeRes.ok) {
      const t = await claudeRes.text();
      console.error("Anthropic error", claudeRes.status, t);
      return jsonResponse({ error: "Could not choose a verse" }, 502);
    }

    const claudeJson = (await claudeRes.json()) as AnthropicResponse;
    const toolUse = claudeJson.content.find((c) => c.type === "tool_use");
    const picked = (toolUse?.input ?? null) as
      | { reference: string; why_it_fits: string }
      | null;
    if (!picked?.reference) return jsonResponse({ error: "No reference returned" }, 502);

    // 2) Fetch the verse text from NLT API.
    const nltKey = Deno.env.get("NLT_API_KEY");
    if (!nltKey) return jsonResponse({ error: "NLT_API_KEY missing" }, 500);

    const nltUrl = `https://api.nlt.to/api/passages?ref=${encodeURIComponent(picked.reference)}&version=NLT&key=${encodeURIComponent(nltKey)}`;
    const nltRes = await fetch(nltUrl);
    if (!nltRes.ok) {
      const t = await nltRes.text();
      console.error("NLT error", nltRes.status, t);
      return jsonResponse({ error: "Could not fetch verse text" }, 502);
    }
    const html = await nltRes.text();
    const text = stripHtml(html);
    if (!text) return jsonResponse({ error: "Empty verse text" }, 502);

    return jsonResponse({
      reference: picked.reference,
      text,
      translation: "New Living Translation (NLT)",
      why_it_fits: picked.why_it_fits,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Verse lookup failed" }, 500);
  }
});
