import { ArrowRight, Users, Layers3, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";

function NetworkVisual() {
  const nodes = [
    [49, 15], [29, 30], [66, 31], [40, 47], [72, 54], [25, 65], [52, 75],
  ];
  return (
    <div className="network-stage" aria-hidden="true">
      <div className="network-orbit network-orbit-one" />
      <div className="network-orbit network-orbit-two" />
      <div className="network-c">C</div>
      {nodes.map(([left, top], index) => <span key={index} className="network-node" style={{ left: `${left}%`, top: `${top}%` }} />)}
    </div>
  );
}

export function CommunityHero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-border/60">
      <div className="hero-glow" aria-hidden="true" />
      <div className="mx-auto grid min-h-[31rem] max-w-7xl items-center gap-6 px-4 py-14 sm:px-6 md:grid-cols-[1.08fr_.92fr] md:py-16 lg:px-8">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" /> Welcome to Coralz
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
            Share <span className="gradient-text">Knowledge.</span><br />Access the <span className="gradient-text">Best.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Discover methods, leaks, tools and more. Join a growing community of creators and learners.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button variant="coralz" size="lg" asChild><a href="#latest">Browse Posts <ArrowRight /></a></Button>
            <Button variant="coralzOutline" size="lg" asChild><a href="#categories">Explore Categories</a></Button>
          </div>
        </div>
        <div className="relative mx-auto h-64 w-full max-w-md md:h-80">
          <NetworkVisual />
          <div className="hero-stats">
            <div><Users /><span><strong>10k+</strong><small>Active members</small></span></div>
            <div><Layers3 /><span><strong>50+</strong><small>Categories</small></span></div>
            <div><Clock3 /><span><strong>24/7</strong><small>Community</small></span></div>
          </div>
        </div>
      </div>
    </section>
  );
}