import Link from 'next/link'
import {
  ArrowRight,
  BellRing,
  BarChart3,
  BookOpen,
  Check,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'

const features = [
  {
    icon: BellRing,
    title: 'Hot flash prediction',
    description: 'See alerts before symptoms peak, with context around possible triggers and practical next steps.',
    featured: true,
  },
  {
    icon: Stethoscope,
    title: 'Your medical profile',
    description: 'Keep personal, lifestyle, medical, medication, allergy, diet, and report details together.',
  },
  {
    icon: BarChart3,
    title: 'Understand your patterns',
    description: 'Turn daily entries into clear scores and visual trends for mood, sleep, stress, and wellbeing.',
  },
  {
    icon: MessageCircle,
    title: 'Support when you need it',
    description: 'Ask the AI assistant questions, browse FAQs, and find a private space for community support.',
  },
  {
    icon: BookOpen,
    title: 'Helpful, timely guidance',
    description: 'Read considered recommendations around diet, mental wellbeing, supplements, and symptom care.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="MenoCare home">
            <img src="/menocare-logo.png" alt="MenoCare" className="h-16 w-32 object-contain" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
            <a href="#how-it-helps" className="transition-colors hover:text-foreground">How it helps</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#privacy" className="transition-colors hover:text-foreground">Privacy</a>
          </nav>
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-primary/90">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Menopause, made more manageable
          </p>
          <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Feel more prepared for what comes next.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            MenoCare brings your symptoms, health information, insights, and support into one calm, private companion—so you can understand your journey with more confidence.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/login?mode=signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-primary/90">
              Start your journey <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#features" className="inline-flex min-h-12 items-center justify-center rounded-full border border-primary/40 px-6 font-semibold text-primary transition-colors hover:bg-secondary">
              Explore MenoCare
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
            {['Private by design', 'Built around your patterns', 'Supportive, not judgmental'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-primary" aria-hidden="true" />{item}</span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2rem] border border-primary/20 bg-secondary p-4 shadow-[0_24px_80px_-35px_rgba(110,57,47,0.55)] sm:p-6">
            <div className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Alerts center</p>
                  <h2 className="mt-2 font-serif text-3xl text-foreground">A little notice can help.</h2>
                </div>
                <BellRing className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <div className="mt-7 rounded-2xl border border-primary/25 bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">Hot flash prediction</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">Moderate</span>
                </div>
                <div className="mt-5 flex items-end gap-4">
                  <div className="relative h-24 w-24 rounded-full" style={{ background: 'conic-gradient(#975d51 0 68%, #f4e5e1 68% 100%)' }}>
                    <div className="absolute inset-2 flex items-center justify-center rounded-full bg-card">
                      <span className="font-serif text-2xl font-semibold text-foreground">68%</span>
                    </div>
                  </div>
                  <p className="max-w-[15rem] text-sm leading-6 text-muted-foreground">Your next few hours may be more sensitive. Keep water close and try a cooler layer.</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/70 p-3"><p className="text-xs text-muted-foreground">Top trigger</p><p className="mt-1 font-semibold text-foreground">Poor sleep</p></div>
                <div className="rounded-xl bg-secondary/70 p-3"><p className="text-xs text-muted-foreground">Confidence</p><p className="mt-1 font-semibold text-foreground">Personalised</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-helps" className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-3 lg:px-8 lg:py-20">
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">01 / Track</p><h2 className="mt-3 font-serif text-3xl">Notice what your body is telling you.</h2></div>
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">02 / Understand</p><h2 className="mt-3 font-serif text-3xl">See patterns beyond a single day.</h2></div>
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">03 / Prepare</p><h2 className="mt-3 font-serif text-3xl">Make small, informed choices with support.</h2></div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Everything in one place</p><h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">A gentler way to navigate your menopause journey.</h2><p className="mt-5 leading-7 text-muted-foreground">From your first daily log to a clearer conversation with your clinician, MenoCare helps make the invisible feel easier to see.</p></div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description, featured }) => (
            <article key={title} className={`rounded-2xl border p-6 ${featured ? 'border-primary bg-primary text-primary-foreground md:col-span-2 lg:col-span-2' : 'border-border bg-card'}`}>
              <Icon className={`h-6 w-6 ${featured ? 'text-primary-foreground' : 'text-primary'}`} aria-hidden="true" />
              <h3 className="mt-6 font-serif text-2xl">{title}</h3>
              <p className={`mt-3 max-w-xl leading-6 ${featured ? 'text-primary-foreground/85' : 'text-muted-foreground'}`}>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="privacy" className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-16 sm:flex-row sm:items-center sm:justify-between lg:px-8 lg:py-20">
          <div className="flex max-w-2xl gap-4"><ShieldCheck className="mt-1 h-7 w-7 shrink-0" aria-hidden="true" /><div><h2 className="font-serif text-3xl">Your story stays yours.</h2><p className="mt-3 leading-7 text-primary-foreground/85">MenoCare is designed to give you a private place to reflect, track, and prepare. You choose what to record and what to bring to a healthcare conversation.</p></div></div>
          <Link href="/login?mode=signup" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-card px-6 font-semibold text-primary transition-colors hover:bg-background">Create your account <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8"><span className="font-serif text-base font-semibold text-foreground">MenoCare</span><span>For education and self-reflection, not a diagnosis.</span></footer>
    </main>
  )
}
