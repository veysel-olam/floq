/**
 * Conformance unit tests for the ActivityPub activity builders. These are pure
 * (no server/DB) and assert that what we emit matches the AP shapes remote
 * servers expect. Complements the live HTTP conformance suite
 * (activitypub-conformance.test.ts, gated behind AP_CONFORMANCE=1).
 */
import { describe, it, expect } from 'vitest'
import {
  buildNote, buildCreate, buildFollow, buildAccept, buildUndo, buildLike,
  buildAnnounce, buildEmojiReact, buildBlock, buildDirectNote, buildDelete,
} from '../lib/activityPub.js'

const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'
const HANDLE = 'alice'
const REMOTE = 'https://mastodon.social/users/bob'

function hasContext(o: { '@context'?: unknown }) {
  const c = o['@context']
  return Array.isArray(c) ? c.includes('https://www.w3.org/ns/activitystreams') : c === 'https://www.w3.org/ns/activitystreams'
}

describe('Note', () => {
  const note = buildNote({
    id: 'p1', content: 'hello #tag', sensitive: false, contentWarning: null,
    visibility: 'public', createdAt: new Date('2026-01-01'), apInReplyTo: null,
    tags: ['tag'], author: { handle: HANDLE },
  })
  it('has @context + Note type + attributedTo', () => {
    expect(hasContext(note)).toBe(true)
    expect(note.type).toBe('Note')
    expect(note.attributedTo).toContain(`/users/${HANDLE}`)
  })
  it('public note addresses Public in to', () => {
    expect(note.to).toContain(PUBLIC)
  })
  it('hashtags become Hashtag tags', () => {
    expect(note.tag?.some((t) => t.type === 'Hashtag' && t.name === '#tag')).toBe(true)
  })
})

describe('Quote (FEP-e232)', () => {
  const q = buildNote({
    id: 'p2', content: 'quoting', sensitive: false, contentWarning: null,
    visibility: 'public', createdAt: new Date(), apInReplyTo: null,
    author: { handle: HANDLE }, quotedApId: REMOTE + '/statuses/1',
  })
  it('exposes quoteUri/quoteUrl/_misskey_quote', () => {
    expect(q.quoteUri).toBe(REMOTE + '/statuses/1')
    expect(q.quoteUrl).toBe(REMOTE + '/statuses/1')
    expect(q._misskey_quote).toBe(REMOTE + '/statuses/1')
  })
  it('adds a Link tag pointing to the quoted object', () => {
    expect(q.tag?.some((t) => t.type === 'Link' && t.href === REMOTE + '/statuses/1')).toBe(true)
  })
})

describe('Direct message', () => {
  const dm = buildDirectNote({
    postId: 'p3', content: 'hi', authorHandle: HANDLE,
    recipientApId: REMOTE, recipientHandle: 'bob@mastodon.social', createdAt: new Date(),
  })
  it('is addressed only to the recipient (no Public)', () => {
    expect(dm.to).toEqual([REMOTE])
    expect(dm.to).not.toContain(PUBLIC)
  })
  it('mentions the recipient', () => {
    expect(dm.tag?.some((t) => t.type === 'Mention' && t.href === REMOTE)).toBe(true)
  })
})

describe('Create wraps a Note with matching addressing', () => {
  const note = buildNote({
    id: 'p4', content: 'x', sensitive: false, contentWarning: null,
    visibility: 'public', createdAt: new Date(), apInReplyTo: null, author: { handle: HANDLE },
  })
  const create = buildCreate(note, HANDLE)
  it('is a Create with the note as object', () => {
    expect(create.type).toBe('Create')
    expect((create.object as { id?: string }).id).toBe(note.id)
    expect(create.to).toEqual(note.to)
  })
})

describe('Follow / Accept / Undo', () => {
  const follow = buildFollow(HANDLE, REMOTE, 'f1')
  it('Follow targets the remote actor', () => {
    expect(follow.type).toBe('Follow')
    expect(follow.object).toBe(REMOTE)
  })
  it('Accept wraps the follow', () => {
    const accept = buildAccept(HANDLE, follow)
    expect(accept.type).toBe('Accept')
    expect((accept.object as { id: string }).id).toBe(follow.id)
  })
  it('Undo wraps + references the activity', () => {
    const undo = buildUndo(HANDLE, follow)
    expect(undo.type).toBe('Undo')
    expect((undo.object as { id: string }).id).toBe(follow.id)
  })
})

describe('Like / Announce / EmojiReact / Block', () => {
  it('Like targets the post', () => {
    const like = buildLike(HANDLE, REMOTE + '/s/1', 'l1')
    expect(like.type).toBe('Like')
    expect(like.object).toBe(REMOTE + '/s/1')
  })
  it('Announce (boost) targets the post', () => {
    const a = buildAnnounce(HANDLE, REMOTE + '/s/1', 'b1')
    expect(a.type).toBe('Announce')
  })
  it('EmojiReact carries the emoji in content', () => {
    const r = buildEmojiReact(HANDLE, REMOTE + '/s/1', 'r1', '🔥')
    expect(r.type).toBe('EmojiReact')
    expect(r.content).toBe('🔥')
    expect(r.object).toBe(REMOTE + '/s/1')
  })
  it('Block targets the actor', () => {
    const b = buildBlock(HANDLE, REMOTE, 'bl1')
    expect(b.type).toBe('Block')
    expect(b.object).toBe(REMOTE)
  })
})

describe('Delete → Tombstone', () => {
  it('produces a Delete with a Tombstone object', () => {
    const d = buildDelete(REMOTE + '/s/1', HANDLE)
    expect(d.type).toBe('Delete')
    const obj = d.object as { type?: string; id?: string }
    expect(obj.id).toBe(REMOTE + '/s/1')
  })
})
