'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Bookmark } from 'lucide-react'
import { api } from '@/lib/api'
import { LoadingBlock } from '@/components/ui/spinner'

// Each category drives its own Tavily search.
//
// topic: the four evidence-based tabs use "general" so Tavily returns clinical
// guidelines and reference sources (NIH, FDA, WHO, Mayo, Cleveland Clinic) instead
// of the magazine coverage "news" yields. "All Articles" stays on "news" because
// there the point *is* recent headlines.
//
// depth: measured per category, "advanced" is NOT uniformly better. It only helps
// supplements (2x pmc.ncbi + EBSCO vs 0 authoritative sources on basic); for diet,
// mindfulness and exercise it consistently returns commercial/content-farm results
// instead (diet: 5/6 authoritative on basic vs 0/6 on advanced). So only
// supplements pays the 2-credit "advanced" cost.
const CATEGORIES = [
  {
    value: 'all',
    label: 'All Articles',
    icon: '📰',
    topic: 'news' as const,
    depth: 'basic' as const,
    q: '',
  },
  {
    value: 'diet',
    label: 'Diet',
    icon: '🥗',
    topic: 'general' as const,
    depth: 'basic' as const,
    q: 'What are the best foods and dietary patterns to reduce menopause symptoms such as hot flashes, night sweats, mood swings, sleep disturbances, and fatigue? Include evidence-based recommendations, foods to eat, foods to limit, nutrients linked to symptom relief, and findings from reputable medical organizations and peer-reviewed research',
  },
  {
    value: 'mindfulness',
    label: 'Mindfulness',
    icon: '🧘',
    topic: 'general' as const,
    depth: 'basic' as const,
    q: 'Best mindfulness techniques for menopause: meditation, breathing exercises, stress reduction, anxiety relief, sleep improvement, and evidence-based recommendations.',
  },
  {
    value: 'supplements',
    label: 'Supplements',
    icon: '💊',
    topic: 'general' as const,
    depth: 'advanced' as const,
    q: 'What natural supplements are effective for reducing menopause hot flashes and other vasomotor symptoms? Include evidence on black cohosh, red clover, sage, soy isoflavones, flaxseed, evening primrose oil, vitamin E, and other commonly used supplements. Summarize benefits, effectiveness, safety, side effects, drug interactions, recommended dosages, and guidance from reputable medical organizations and peer-reviewed research.',
  },
  {
    value: 'exercise',
    label: 'Exercise',
    icon: '💪',
    topic: 'general' as const,
    depth: 'basic' as const,
    q: 'Best exercises for menopausal women: strength training, aerobic exercise, yoga, Pilates, walking, and resistance training for weight management, mood improvement, bone health, and menopause symptom relief. Include evidence-based recommendations and clinical research.',
  },
]

interface Article { title: string; url: string; content: string; published_date?: string }

export default function LatestNewsPage() {
  const [category, setCategory] = useState('all')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set())

  useEffect(() => {
    const cat = CATEGORIES.find((c) => c.value === category)
    setLoading(true)
    api.latestInfo(cat?.q || undefined, cat?.topic, cat?.depth)
      .then(setData)
      .catch((e) => setData({ error: e.message, results: [] }))
      .finally(() => setLoading(false))
  }, [category])

  const articles: Article[] = data?.results || []
  const icon = CATEGORIES.find((c) => c.value === category)?.icon || '📰'

  const toggleBookmark = (id: string) => {
    setBookmarked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hostname = (u: string) => {
    try { return new URL(u).hostname.replace('www.', '') } catch { return u }
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="bg-secondary px-4 py-6 border-b border-border mb-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Latest News & Articles</h1>
          <p className="text-foreground/60">
            Fresh, sourced content about menopause and wellness — powered by Tavily search.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wide">Filter by Category</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  category === cat.value
                    ? 'bg-primary text-white'
                    : 'bg-card border border-border text-foreground hover:border-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <LoadingBlock label="Fetching the latest…" />}

        {!loading && data?.configured === false && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-6 mb-8 text-sm text-foreground">
            <b>Latest News isn’t configured yet.</b> {data.message} Set{' '}
            <code className="bg-background px-1.5 py-0.5 rounded">TAVILY_API_KEY</code> in the backend and restart.
          </div>
        )}
        {!loading && data?.error && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-6 mb-8 text-sm text-foreground">{data.error}</div>
        )}

        {!loading && data?.answer && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 p-6 border border-primary/30">
            <h2 className="text-sm font-bold uppercase tracking-wide text-primary mb-2">In short</h2>
            <p className="text-foreground/80 leading-relaxed">{data.answer}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {articles.map((article, idx) => {
            const id = article.url || String(idx)
            return (
              <div key={id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col">
                <div className="w-full h-40 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border-b border-border">
                  <p className="text-4xl">{icon}</p>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-foreground mb-2 line-clamp-2">{article.title}</h3>
                  <p className="text-sm text-foreground/70 mb-4 line-clamp-3">{article.content}</p>
                  <div className="text-xs text-foreground/50 mb-4 flex-1">
                    <p>{hostname(article.url)}</p>
                    {article.published_date && <p>{article.published_date}</p>}
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <a href={article.url} target="_blank" rel="noreferrer noopener"
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-background hover:bg-primary/10 rounded-lg transition-colors text-sm font-medium text-foreground">
                      <ExternalLink className="w-4 h-4" /> Read More
                    </a>
                    <button onClick={() => toggleBookmark(id)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        bookmarked.has(id) ? 'bg-primary/20 text-primary' : 'bg-background hover:bg-background text-foreground/60'
                      }`}>
                      <Bookmark className="w-5 h-5" fill={bookmarked.has(id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!loading && articles.length === 0 && data?.configured !== false && !data?.error && (
          <div className="text-center py-16"><p className="text-foreground/60 text-lg">No articles found right now.</p></div>
        )}
      </div>
    </div>
  )
}
