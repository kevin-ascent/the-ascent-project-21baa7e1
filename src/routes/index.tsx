import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Mountain } from "lucide-react";
import logoAsset from "@/assets/ascent-logo.png.asset.json";
import sunsetMountainsAsset from "@/assets/sunset-mountains.jpg.asset.json";



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
        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex" />

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
        src={sunsetMountainsAsset.url}
        alt="Sunset mountain landscape"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover object-center"
        priority="true"
      />
      <div className="absolute inset-0 bg-background/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/20 to-background" />
      <div className="relative mx-auto max-w-6xl px-6 pb-32 pt-32 md:pb-48 md:pt-40 flex flex-col items-center text-center">
        <img
          src={logoAsset.url}
          alt="The Ascent — Men's Ministry, Life Church"
          width={420}
          height={420}
          className="w-64 md:w-80 h-auto drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        />
        <p className="mt-8 max-w-xl text-lg text-summit md:text-xl drop-shadow-md">
          Climb higher, together.{" "}
          <br />
          Every step upward with Scripture as your guide.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <a
            href="/auth"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 shadow-lg"
          >
            Start the climb
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}


