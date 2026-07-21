import { ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";

/** Creative, animated, responsive "back to landing" pill. */
export function BackToHome({ label, to = "/" }: { label: string; to?: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex max-w-full items-center gap-2 rounded-full border border-line/15 bg-card/60 py-1.5 pl-1.5 pr-3.5 text-sm font-medium text-muted backdrop-blur-xl transition-all duration-300 hover:-translate-x-0.5 hover:border-accent/40 hover:text-ink hover:shadow-glow sm:py-2 sm:pl-2 sm:pr-4"
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-accent transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-accent group-hover:to-accent-dark group-hover:text-white">
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-7" />
        <Home className="absolute h-4 w-4 translate-x-7 transition-transform duration-300 group-hover:translate-x-0" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
