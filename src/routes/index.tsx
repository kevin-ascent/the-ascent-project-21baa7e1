import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Mountain, Compass, Flag, Sunrise } from "lucide-react";
import heroImg from "@/assets/ascent-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Ascent — Climb your own mountain" },
      {
        name: "description",
        content:
          "The Ascent is a deliberate practice ritual for ambitious people. Set your summit, track the climb, see the view.",
      },
      { property: "og:title", content: "The Ascent — Climb your own mountain" },
      {
        property: "og:description",
        content:
          "The Ascent is a deliberate practice ritual for ambitious people. Set your summit, track the climb, see the view.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <Manifesto />
      <Pillars />
      <Ritual />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <a href="#" className="flex items-center gap-2 font-display text-lg tracking-tight">
          <Mountain className="h-5 w-5 text-primary" strokeWidth={1.5} />
          <span>The Ascent</span>
        </a>
        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          <a href="#manifesto" className="transition-colors hover:text-foreground">Manifesto</a>
          <a href="#pillars" className="transition-colors hover:text-foreground">Pillars</a>
          <a href="#ritual" className="transition-colors hover:text-foreground">Ritual</a>
        </nav>
        <a
          href="/auth"
          className="rounded-full border border-border bg-card/40 px-4 py-2 text-sm backdrop-blur transition-colors hover:bg-card"
        >
          Begin
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <img
        src={heroImg}
        alt="Mountain silhouette at dawn"
        width={1920}
        height={1280}
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
      <div className="relative mx-auto max-w-6xl px-6 pb-32 pt-44 md:pb-48 md:pt-56">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
          <Sunrise className="h-3 w-3 text-primary" /> Chapter I
        </p>
        <h1 className="max-w-3xl text-5xl leading-[1.02] md:text-7xl">
          Climb your own
          <span className="block italic text-primary">mountain.</span>
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted-foreground md:text-xl">
          The Ascent is a quiet ritual for ambitious people. Name your summit, take
          the next honest step, and watch the horizon widen.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="/auth"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Start the climb
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <a
            href="#manifesto"
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm text-foreground/90 transition-colors hover:bg-card/50"
          >
            Read the manifesto
          </a>
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section id="manifesto" className="border-t border-border/40 bg-background">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-28 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Manifesto</p>
        </div>
        <div className="md:col-span-8">
          <p className="font-display text-3xl leading-snug md:text-4xl">
            Most apps measure motion. <span className="text-muted-foreground">Few measure altitude.</span>
          </p>
          <p className="mt-8 max-w-2xl text-lg text-muted-foreground">
            We built The Ascent because the work that matters rarely arrives in a notification.
            It arrives in cold mornings, small commitments kept, and the patience to walk a slope
            you cannot see the top of. This is for the climbers, not the scrollers.
          </p>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    {
      icon: Flag,
      title: "Name the summit",
      body: "One mountain at a time. Choose what's worth a season of your life and write it where you'll see it daily.",
    },
    {
      icon: Compass,
      title: "Walk the ridge",
      body: "A daily three-minute check-in. What did you carry today? What did you leave behind? Where is the wind?",
    },
    {
      icon: Mountain,
      title: "See the view",
      body: "Weekly altitude reports replace vanity metrics. You see how far you've climbed, not how busy you were.",
    },
  ];
  return (
    <section id="pillars" className="border-t border-border/40">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <div className="mb-16 flex items-end justify-between">
          <h2 className="max-w-md text-4xl md:text-5xl">Three pillars, no clutter.</h2>
          <p className="hidden text-sm text-muted-foreground md:block">The whole product, on one card.</p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="group relative bg-card p-8 transition-colors hover:bg-card/70">
              <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/50">
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl">{title}</h3>
              <p className="mt-3 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Ritual() {
  const steps = [
    { n: "01", title: "Dawn", body: "Open the app. Read your summit. Set one stone for today." },
    { n: "02", title: "Trail", body: "Move. Don't log the noise. The Ascent isn't watching your steps — it's watching your direction." },
    { n: "03", title: "Dusk", body: "Two lines. What did the day teach? Lay the stone. Close the book." },
    { n: "04", title: "Sunday", body: "Sit with your altitude report. Adjust the route. Keep the summit." },
  ];
  return (
    <section id="ritual" className="border-t border-border/40 bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">The Ritual</p>
        <h2 className="mt-4 max-w-2xl text-4xl md:text-5xl">A week on the mountain.</h2>
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-6 bg-background p-8">
              <span className="font-display text-3xl text-primary/80">{s.n}</span>
              <div>
                <h3 className="text-xl">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="join" className="border-t border-border/40">
      <div className="mx-auto max-w-3xl px-6 py-28 text-center">
        <h2 className="text-4xl md:text-6xl">
          The mountain is <span className="italic text-primary">waiting.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
          Join the early climbers. We're letting in small groups so the trail stays quiet.
        </p>
        <form
          className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            required
            placeholder="you@basecamp.com"
            className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Request invite
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <Mountain className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <span className="font-display">The Ascent</span>
        </div>
        <p>© {new Date().getFullYear()} — Climb deliberately.</p>
      </div>
    </footer>
  );
}
