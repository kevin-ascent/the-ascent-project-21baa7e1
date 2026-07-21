import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — The Ascent" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tradition, setTradition] = useState("");
  const [intention, setIntention] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (data?.preferred_name) {
        navigate({ to: "/home" });
      } else {
        setChecking(false);
      }
    })();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").upsert({
        id: userData.user.id,
        preferred_name: name.trim(),
        faith_tradition: tradition.trim() || null,
        intention: intention.trim() || null,
      });
      if (error) throw error;
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-background text-foreground">
      <div className="w-full max-w-lg">
        <h1 className="font-display text-4xl tracking-tight">A few questions to begin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This helps us personalize your reflection. You can change it later.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">What should we call you?</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tradition">Faith tradition (optional)</Label>
            <Input
              id="tradition"
              value={tradition}
              onChange={(e) => setTradition(e.target.value)}
              placeholder="e.g. Non-denominational, Catholic, Just exploring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="intention">What do you want from this practice? (optional)</Label>
            <Textarea
              id="intention"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              rows={3}
              placeholder="A sentence or two."
            />
          </div>
          <Button type="submit" disabled={loading || !name.trim()} className="w-full">
            {loading ? "Saving..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
