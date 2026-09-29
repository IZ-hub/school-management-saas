import { useEffect, useRef, useState } from 'react'
import { Box, Button, ButtonBase, CircularProgress, IconButton, InputBase, Stack, Typography } from '@mui/material'
import {
  ChatBubbleOutline as ChatIcon,
  NorthEast as PopOutIcon,
  Remove as MinimizeIcon,
  RoomService as BellIcon,
  Send as SendIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material'
import { useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

const BRAND = '#0d3b2e'
const WHATSAPP_NUMBER = '2347061102797'
const STORAGE_KEY = 'schoolful-support-chat'
const PUBLIC_PAGES = ['/', '/login', '/register']

type Bubble = {
  id: string
  from: 'visitor' | 'team'
  text: string
  status?: 'sending' | 'sent' | 'failed'
  kind?: 'ask-details' | 'thanks'
}

type Saved = { conversationId: string; name: string; email: string; bubbles: Bubble[] }

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Chat history is a per-visitor convenience; storage may be unavailable (private mode), so never depend on it.
function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}
function save(data: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable */
  }
}

const whatsappLink = (text?: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text ? `Hi Schoolful LMS, ${text}` : 'Hi Schoolful LMS, I have a question.')}`

/** "Schoolful LMS Support" chat launcher and panel, fixed to the bottom-right corner. */
export default function SupportWidget() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const saved = useRef(load())

  const [open, setOpen] = useState(false)
  const [conversationId] = useState(saved.current?.conversationId ?? newId())
  const [bubbles, setBubbles] = useState<Bubble[]>(saved.current?.bubbles.filter((b) => b.status !== 'sending') ?? [])
  const [name, setName] = useState(saved.current?.name ?? '')
  const [email, setEmail] = useState(saved.current?.email ?? '')
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<Bubble | null>(null)
  const [detailsError, setDetailsError] = useState('')
  const [website, setWebsite] = useState('') // hidden trap field for bots

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  // Logged-in users don't need to tell us who they are.
  const knownName = name || (user ? `${user.firstName} ${user.lastName}`.trim() : '')
  const knownEmail = email || user?.email || ''
  const hasDetails = !!knownName && !!knownEmail

  useEffect(() => {
    save({ conversationId, name, email, bubbles })
  }, [conversationId, name, email, bubbles])

  // Inside the app the sidebar's "Help & support" opens the chat instead of a floating button.
  useEffect(() => {
    const openChat = () => setOpen(true)
    window.addEventListener('schoolful:open-support', openChat)
    return () => window.removeEventListener('schoolful:open-support', openChat)
  }, [])
  const showLauncher = PUBLIC_PAGES.includes(location.pathname)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
    }
  }, [open])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [bubbles, pending])

  const updateBubble = (id: string, patch: Partial<Bubble>) =>
    setBubbles((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  const deliver = async (bubble: Bubble, who: { name: string; email: string }) => {
    updateBubble(bubble.id, { status: 'sending' })
    try {
      await api.post('/support/messages', {
        name: who.name,
        email: who.email,
        message: bubble.text,
        conversationId,
        page: location.pathname,
        ...(website ? { website } : {}),
      })
      updateBubble(bubble.id, { status: 'sent' })
      setBubbles((bs) =>
        bs.some((b) => b.kind === 'thanks')
          ? bs
          : [
              ...bs,
              {
                id: newId(),
                from: 'team',
                kind: 'thanks',
                text: `Thanks, ${who.name.split(' ')[0]}! We've got your message and will reply to ${who.email}, usually within a few hours on school days. Need an answer right now? Chat with us on WhatsApp.`,
              },
            ],
      )
    } catch {
      updateBubble(bubble.id, { status: 'failed' })
    }
  }

  const sendDraft = () => {
    const text = draft.trim()
    if (!text) return
    const bubble: Bubble = { id: newId(), from: 'visitor', text, status: hasDetails ? 'sending' : undefined }
    setBubbles((bs) => [...bs, bubble])
    setDraft('')
    if (hasDetails) {
      deliver(bubble, { name: knownName, email: knownEmail })
    } else {
      setPending(bubble)
    }
  }

  const submitDetails = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setDetailsError('Please enter your name.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setDetailsError('Please enter a valid email address.')
    setDetailsError('')
    const bubble = pending!
    setPending(null)
    deliver(bubble, { name: name.trim(), email: email.trim() })
  }

  const lastVisitorText = [...bubbles].reverse().find((b) => b.from === 'visitor')?.text

  return (
    <>
      {/* Launcher */}
      {!open && showLauncher && (
        <ButtonBase
          onClick={() => setOpen(true)}
          aria-label="Open Schoolful LMS support chat"
          sx={{
            position: 'fixed', right: 20, bottom: { xs: 16, sm: 12 }, zIndex: 1250,
            height: 50, px: 2.5, borderRadius: 999, bgcolor: BRAND, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 1,
            boxShadow: '0 4px 14px rgba(13,59,46,0.35)', transition: 'transform 0.15s, box-shadow 0.15s',
            '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 6px 18px rgba(13,59,46,0.4)' },
            '&:focus-visible': { outline: '3px solid #aed581', outlineOffset: 2 },
          }}
        >
          <ChatIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '16px' }}>Chat</Typography>
        </ButtonBase>
      )}

      {/* Panel */}
      {open && (
        <Box
          role="dialog"
          aria-label="Schoolful LMS Support"
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          sx={{
            position: 'fixed', zIndex: 1250, bottom: 16,
            right: { xs: 16, sm: 16 }, left: { xs: 16, sm: 'auto' },
            width: { sm: 342 }, height: 541, maxHeight: 'calc(100dvh - 32px)',
            bgcolor: '#fff', borderRadius: '8px', overflow: 'hidden',
            boxShadow: '0 5px 40px rgba(0,0,0,0.16)',
            display: 'flex', flexDirection: 'column',
            animation: 'supportIn 0.2s ease-out',
            '@keyframes supportIn': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'none' } },
          }}
        >
          {/* Header */}
          <Box sx={{ bgcolor: BRAND, color: '#fff', height: 44, display: 'flex', alignItems: 'center', position: 'relative', flexShrink: 0 }}>
            <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '15px', px: 9 }}>
              Schoolful LMS Support
            </Typography>
            <Stack direction="row" sx={{ position: 'absolute', right: 6 }}>
              <IconButton
                component="a"
                href={whatsappLink(lastVisitorText)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Continue on WhatsApp"
                title="Continue on WhatsApp"
                size="small"
                sx={{ color: '#fff' }}
              >
                <PopOutIcon fontSize="small" />
              </IconButton>
              <IconButton aria-label="Minimise chat" title="Minimise" size="small" onClick={() => setOpen(false)} sx={{ color: '#fff' }}>
                <MinimizeIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          {/* Agent row */}
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, py: 1.25, boxShadow: '0 1px 4px rgba(0,0,0,0.12)', zIndex: 1, flexShrink: 0 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: '#8a9290', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BellIcon sx={{ color: '#fff', fontSize: 19 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#2f3941', lineHeight: 1.3 }}>Live Support</Typography>
              <Typography sx={{ fontSize: '14px', color: '#2f3941', lineHeight: 1.3 }}>Ask us anything.</Typography>
            </Box>
          </Stack>

          {/* Conversation */}
          <Box ref={threadRef} aria-live="polite" sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {bubbles.map((b) => (
              <Box key={b.id} sx={{ alignSelf: b.from === 'visitor' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <Box
                  sx={{
                    px: 1.5, py: 1, fontSize: '14px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    borderRadius: b.from === 'visitor' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    bgcolor: b.from === 'visitor' ? BRAND : '#f1f3f2', color: b.from === 'visitor' ? '#fff' : '#2f3941',
                  }}
                >
                  {b.text}
                </Box>
                {b.kind === 'thanks' && (
                  <Button
                    href={whatsappLink(lastVisitorText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<WhatsAppIcon />}
                    size="small"
                    sx={{ mt: 0.75, textTransform: 'none', fontWeight: 600, borderRadius: 999, bgcolor: '#25d366', color: '#fff', px: 1.75, '&:hover': { bgcolor: '#1ebe5a' } }}
                  >
                    Continue on WhatsApp
                  </Button>
                )}
                {b.from === 'visitor' && b.status && (
                  <Typography sx={{ fontSize: '11.5px', color: b.status === 'failed' ? '#b3261e' : '#87929d', textAlign: 'right', mt: 0.25 }}>
                    {b.status === 'sending' && 'Sending…'}
                    {b.status === 'sent' && 'Sent'}
                    {b.status === 'failed' && (
                      <>
                        Not sent.{' '}
                        <Box component="button" type="button" onClick={() => deliver(b, { name: knownName, email: knownEmail })}
                          sx={{ border: 0, p: 0, bgcolor: 'transparent', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
                          Retry
                        </Box>
                      </>
                    )}
                  </Typography>
                )}
              </Box>
            ))}

            {pending && (
              <Box component="form" onSubmit={submitDetails} noValidate sx={{ alignSelf: 'flex-start', width: '92%', bgcolor: '#f1f3f2', borderRadius: '14px 14px 14px 4px', p: 1.5 }}>
                <Typography sx={{ fontSize: '14px', color: '#2f3941', mb: 1 }}>
                  So we can reply, please leave your name and email.
                </Typography>
                {[
                  { label: 'Your name', value: name, set: setName, type: 'text', auto: 'name' },
                  { label: 'Email', value: email, set: setEmail, type: 'email', auto: 'email' },
                ].map((f) => (
                  <InputBase
                    key={f.label}
                    inputProps={{ 'aria-label': f.label, type: f.type, autoComplete: f.auto }}
                    placeholder={f.label}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    fullWidth
                    sx={{ bgcolor: '#fff', border: '1px solid #d8dcde', borderRadius: '4px', px: 1.25, py: 0.5, mb: 1, fontSize: '16px', '&.Mui-focused': { borderColor: BRAND } }}
                  />
                ))}
                {/* Bots fill every field they see; people never see this one. */}
                <Box component="input" tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebsite(e.target.value)}
                  name="website" sx={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
                {detailsError && <Typography sx={{ fontSize: '12.5px', color: '#b3261e', mb: 1 }}>{detailsError}</Typography>}
                <Button type="submit" fullWidth variant="contained" sx={{ bgcolor: BRAND, textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#14523f', boxShadow: 'none' } }}>
                  Send message
                </Button>
              </Box>
            )}
          </Box>

          {/* Composer */}
          <Box sx={{ px: 2, pt: 1, pb: 1.25, flexShrink: 0 }}>
            <InputBase
              inputRef={inputRef}
              multiline
              minRows={3}
              maxRows={5}
              placeholder="Type a message here..."
              value={draft}
              disabled={!!pending}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendDraft()
                }
              }}
              inputProps={{ 'aria-label': 'Type a message' }}
              fullWidth
              sx={{
                border: '1px solid #d8dcde', borderRadius: '4px', px: 1.5, py: 1,
                fontSize: { xs: '16px', sm: '14px' }, color: '#2f3941',
                '&.Mui-focused': { borderColor: BRAND, boxShadow: `0 0 0 1px ${BRAND}` },
              }}
            />
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
              <Typography sx={{ fontSize: '12px', color: '#87929d' }}>We usually reply within a few hours</Typography>
              <IconButton aria-label="Send message" onClick={sendDraft} disabled={!draft.trim() || !!pending} size="small" sx={{ color: BRAND }}>
                {bubbles.some((b) => b.status === 'sending') ? <CircularProgress size={18} sx={{ color: BRAND }} /> : <SendIcon fontSize="small" />}
              </IconButton>
            </Stack>
          </Box>
        </Box>
      )}
    </>
  )
}
