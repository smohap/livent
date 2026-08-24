import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Instagram,
  Linkedin,
  Menu,
  Sparkles,
  Twitter,
  Wand2,
} from 'lucide-react';
import seatingThumb from '@/assets/hero-seating.svg';

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4';

const SOCIALS = [
  { Icon: Twitter, label: 'livent on Twitter' },
  { Icon: Linkedin, label: 'livent on LinkedIn' },
  { Icon: Instagram, label: 'livent on Instagram' },
];

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <video
        className="fixed inset-0 z-0 h-full w-full object-cover"
        src={HERO_VIDEO}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
      />
      <div aria-hidden className="fixed inset-0 z-0 bg-black/25" />

      <div className="relative z-10 flex min-h-screen">
        <LeftPanel />
        <RightPanel />
      </div>
    </div>
  );
}

function LeftPanel() {
  return (
    <section className="relative flex w-full flex-col lg:w-[52%]">
      <div className="liquid-glass-strong pointer-events-none absolute inset-4 rounded-3xl lg:inset-6" />

      <div className="relative flex flex-1 flex-col px-10 py-10 lg:px-14">
        <nav className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" width={32} height={32} />
            <span className="text-2xl font-semibold tracking-tighter text-white">livent</span>
          </Link>
          <button
            type="button"
            className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2 text-xs text-white/80 transition-transform hover:scale-105"
          >
            <Menu className="h-3.5 w-3.5" />
            Menu
          </button>
        </nav>

        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <img src="/logo.svg" alt="" width={80} height={80} className="mb-8 opacity-90" />

          <h1 className="max-w-[15ch] text-6xl leading-[0.95] tracking-[-0.05em] text-white lg:text-7xl">
            The operating system for{' '}
            <em className="font-serif not-italic text-white/80 [font-style:italic]">every event</em>
          </h1>

          <p className="mt-7 max-w-md text-sm leading-relaxed text-white/60">
            One master event, unlimited connected phases. Plan it. Invite. Coordinate. Pay.
            Experience. Remember.
          </p>

          <Link
            to="/signup"
            className="liquid-glass-strong mt-9 inline-flex items-center gap-3 rounded-full py-2.5 pl-6 pr-2.5 text-sm text-white transition-transform hover:scale-105 active:scale-95"
          >
            Start planning
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <div className="mt-10 flex flex-wrap justify-center gap-2.5">
            {['Multi-phase events', 'Seating engine', 'Guest experience'].map((pill) => (
              <span key={pill} className="liquid-glass rounded-full px-4 py-2 text-xs text-white/80">
                {pill}
              </span>
            ))}
          </div>
        </div>

        <footer className="text-center">
          <p className="eyebrow">Event operating system</p>
          <p className="mx-auto mt-4 max-w-lg text-xl leading-snug text-white">
            <span className="font-display">A wedding is not one event.</span>{' '}
            <span className="font-serif italic text-white/75">It is five, told as one story.</span>
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-white/20" />
            <span className="text-[0.68rem] uppercase tracking-[0.2em] text-white/50">
              Livent product principle
            </span>
            <span className="h-px w-12 bg-white/20" />
          </div>
        </footer>
      </div>
    </section>
  );
}

function RightPanel() {
  return (
    <section className="relative hidden w-[48%] flex-col px-10 py-10 lg:flex">
      <div className="flex items-center justify-between">
        <div className="liquid-glass flex items-center gap-4 rounded-full px-5 py-2.5">
          {SOCIALS.map(({ Icon, label }) => (
            <a
              key={label}
              href="#"
              aria-label={label}
              className="text-white transition-colors hover:text-white/80"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
          <span className="h-4 w-px bg-white/15" />
          <ArrowRight className="h-3.5 w-3.5 text-white/60" />
        </div>

        <div className="flex items-center gap-2.5">
          <span className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full">
            <Sparkles className="h-4 w-4 text-white/80" />
          </span>
          <Link
            to="/login"
            className="liquid-glass rounded-full px-5 py-2.5 text-xs text-white/80 transition-transform hover:scale-105"
          >
            Account
          </Link>
        </div>
      </div>

      <div className="liquid-glass mt-8 w-56 rounded-[1.1rem] p-5">
        <h3 className="text-sm text-white">Enter our ecosystem</h3>
        <p className="mt-2 text-xs leading-relaxed text-white/55">
          Organisers, teams, vendors and guests working from one shared event workspace.
        </p>
      </div>

      <div className="liquid-glass mt-auto rounded-[2.5rem] p-4">
        <div className="grid grid-cols-2 gap-4">
          <FeatureCard
            Icon={Wand2}
            title="Run of show"
            body="Live event-day control: what is happening now, what is next, and who owns it."
          />
          <FeatureCard
            Icon={BookOpen}
            title="Event archive"
            body="Photos, messages and the full timeline, kept together after the last guest leaves."
          />
        </div>

        <div className="liquid-glass mt-4 flex items-center gap-4 rounded-3xl p-4">
          <img
            src={seatingThumb}
            alt=""
            width={96}
            height={64}
            className="h-16 w-24 shrink-0 rounded-2xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm text-white">Intelligent seating</h4>
            <p className="mt-1 text-xs leading-relaxed text-white/55">
              Rules, constraints and dietary data resolved into a table plan in one click.
            </p>
          </div>
          <button
            type="button"
            aria-label="More about intelligent seating"
            className="liquid-glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 transition-transform hover:scale-105"
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  Icon,
  title,
  body,
}: {
  Icon: typeof Wand2;
  title: string;
  body: string;
}) {
  return (
    <div className="liquid-glass rounded-3xl p-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
        <Icon className="h-4 w-4 text-white/85" />
      </span>
      <h4 className="mt-4 text-sm text-white">{title}</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-white/55">{body}</p>
    </div>
  );
}
