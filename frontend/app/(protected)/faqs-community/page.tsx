'use client'

import { useEffect, useState } from 'react'
import { mockFAQs } from '@/lib/mockData'
import { useApp } from '@/lib/AppContext'
import { api } from '@/lib/api'
import { LoadingBlock, Spinner } from '@/components/ui/spinner'
import { ChevronDown, MessageCircle, Plus, Heart, PenLine } from 'lucide-react'

export default function FAQsCommunityPage() {
  const { user } = useApp()
  const authorName = user?.name || 'Anonymous'

  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

  // Community feed (backend-backed)
  const [posts, setPosts] = useState<any[]>([])
  const [open, setOpen] = useState<any | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [draft, setDraft] = useState({ title: '', body: '' })
  const [comment, setComment] = useState('')

  // Per-action loading flags so every async control shows feedback.
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [likingId, setLikingId] = useState<number | null>(null)
  const [commenting, setCommenting] = useState(false)

  const load = () => api.listBlogs().then(setPosts).catch(() => {})
  useEffect(() => {
    load().finally(() => setLoadingPosts(false))
  }, [])

  const submitPost = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return
    setPublishing(true)
    try {
      await api.createBlog({ ...draft, author: authorName })
      setDraft({ title: '', body: '' })
      setShowCompose(false)
      await load()
    } catch {
      /* leave the feed as-is; the next load reconciles */
    } finally {
      setPublishing(false)
    }
  }
  const openPost = async (id: number) => {
    if (open?.id === id) return setOpen(null)
    setOpeningId(id)
    try {
      setOpen(await api.getBlog(id))
    } catch {
      /* leave the feed as-is; the next load reconciles */
    } finally {
      setOpeningId(null)
    }
  }
  const like = async (id: number) => {
    setLikingId(id)
    try {
      await api.likeBlog(id)
      await load()
      if (open?.id === id) setOpen(await api.getBlog(id))
    } catch {
      /* leave the feed as-is; the next load reconciles */
    } finally {
      setLikingId(null)
    }
  }
  const sendComment = async (id: number) => {
    if (!comment.trim()) return
    setCommenting(true)
    try {
      await api.commentBlog(id, { body: comment, author: authorName })
      setComment('')
      setOpen(await api.getBlog(id))
      await load()
    } catch {
      /* leave the feed as-is; the next load reconciles */
    } finally {
      setCommenting(false)
    }
  }
  const fmt = (iso: string) => new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="mb-6 border-b border-border bg-secondary px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">MenoCare community</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">FAQs & Community</h1>
          <p className="mt-2 text-foreground/60">Read helpful answers and share your experience with other members.</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4">
        {/* FAQs */}
        <section>
          <h2 className="mb-4 text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {mockFAQs.map((faq) => (
              <article key={faq.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <button onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-secondary/40">
                  <div><h3 className="font-bold text-foreground">{faq.question}</h3><span className="mt-2 inline-block rounded bg-secondary px-2 py-1 text-xs text-primary">{faq.category}</span></div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform ${expandedFAQ === faq.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {expandedFAQ === faq.id && (
                  <div className="border-t border-border bg-background/60 p-4">
                    <p className="leading-7 text-foreground/80">{faq.answer}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Community feed */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="text-2xl font-bold text-foreground">Community Center</h2>
            </div>
            <button onClick={() => setShowCompose((s) => !s)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <PenLine className="h-4 w-4" aria-hidden="true" /> {showCompose ? 'Close' : 'Write a post'}
            </button>
          </div>

          {showCompose && (
            <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-3">
              <input value={draft.title} maxLength={160} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Title — e.g. What eased my night sweats"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40" />
              <textarea value={draft.body} rows={4} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Share your experience, a tip, or a question…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40" />
              <div className="text-xs text-foreground/50">Posting as <b>{authorName}</b></div>
              <button onClick={submitPost} disabled={publishing || !draft.title.trim() || !draft.body.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {publishing
                  ? <><Spinner size="sm" /> Publishing…</>
                  : <><Plus className="h-4 w-4" aria-hidden="true" /> Publish</>}
              </button>
            </div>
          )}

          {loadingPosts && <LoadingBlock label="Loading community posts…" className="rounded-xl border border-border bg-card" />}

          {!loadingPosts && posts.length === 0 && <p className="rounded-xl border border-border bg-card p-6 text-sm text-foreground/60">No posts yet — be the first to share.</p>}

          <div className="space-y-3">
            {posts.map((p) => (
              <article key={p.id} className="rounded-xl border border-border bg-card p-4">
                <h3 onClick={() => openPost(p.id)} className="cursor-pointer text-lg font-bold text-foreground hover:text-primary">{p.title}</h3>
                <p className="mt-1 text-xs text-foreground/50">by {p.author} · {fmt(p.created_at)}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{p.body}</p>
                <div className="mt-3 flex gap-3">
                  <button onClick={() => like(p.id)} disabled={likingId === p.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-sm text-foreground hover:border-primary disabled:opacity-50">
                    {likingId === p.id
                      ? <Spinner size="sm" />
                      : <Heart className="h-4 w-4" aria-hidden="true" />} {p.likes}
                  </button>
                  <button onClick={() => openPost(p.id)} disabled={openingId === p.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-sm text-foreground hover:border-primary disabled:opacity-50">
                    {openingId === p.id
                      ? <Spinner size="sm" />
                      : <MessageCircle className="h-4 w-4" aria-hidden="true" />} {p.comment_count}{open?.id === p.id ? ' · hide' : ''}
                  </button>
                </div>

                {open?.id === p.id && (
                  <div className="mt-4 space-y-3 border-t border-border pt-3">
                    {open.comments.map((c: any) => (
                      <div key={c.id} className="rounded-lg border-l-2 border-primary bg-background p-3">
                        <p className="text-sm text-foreground/80">{c.body}</p>
                        <p className="mt-1 text-xs text-foreground/50">{c.author} · {fmt(c.created_at)}</p>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={comment} onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendComment(p.id)}
                        disabled={commenting}
                        placeholder="Add a supportive comment…"
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 disabled:opacity-50" />
                      <button onClick={() => sendComment(p.id)} disabled={commenting || !comment.trim()}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                        {commenting ? <><Spinner size="sm" /> Sending…</> : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
