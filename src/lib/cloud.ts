import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Account, Note, NotesByAccount, Trade } from '@/lib/types'

const BATCH_LIMIT = 400

function requireDb() {
  if (!db) throw new Error('Firebase is not configured.')
  return db
}

function accountsCol(uid: string) {
  return collection(requireDb(), 'users', uid, 'accounts')
}

function tradesCol(uid: string) {
  return collection(requireDb(), 'users', uid, 'trades')
}

function notesCol(uid: string) {
  return collection(requireDb(), 'users', uid, 'notes')
}

function imagesCol(uid: string) {
  return collection(requireDb(), 'users', uid, 'images')
}

function noteDocId(accountId: string, date: string) {
  return `${accountId.replace(/[/\\]/g, '-')}__${date}`
}

function byCreatedDesc(a: Account, b: Account) {
  return (b.createdAt || '').localeCompare(a.createdAt || '')
}

function tradeSortKey(trade: Trade) {
  return `${trade.date}${trade.openTime}`
}

/** True when this account already has at least one account document. */
export async function hasCloudWorkspace(uid: string): Promise<boolean> {
  const snapshot = await getDocs(query(accountsCol(uid), limit(1)))
  return !snapshot.empty
}

export async function ensureUserProfile(
  uid: string,
  profile: { name?: string; email?: string },
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (profile.name) payload.name = profile.name
  if (profile.email) payload.email = profile.email
  await setDoc(doc(requireDb(), 'users', uid), payload, { merge: true })
}

/* ------------------------------------------------------------------ */
/* Realtime reads                                                      */
/* ------------------------------------------------------------------ */

export function subscribeAccounts(
  uid: string,
  next: (accounts: Account[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    accountsCol(uid),
    (snapshot) => {
      const accounts = snapshot.docs
        .map((item) => ({ ...(item.data() as Omit<Account, 'id'>), id: item.id }) as Account)
        .sort(byCreatedDesc)
      next(accounts)
    },
    (error) => onError?.(error),
  )
}

export function subscribeTrades(
  uid: string,
  next: (trades: Trade[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    tradesCol(uid),
    (snapshot) => {
      const trades = snapshot.docs
        .map((item) => ({ ...(item.data() as Omit<Trade, 'id'>), id: item.id }) as Trade)
        .sort((a, b) => tradeSortKey(a).localeCompare(tradeSortKey(b)))
      next(trades)
    },
    (error) => onError?.(error),
  )
}

export function subscribeNotes(
  uid: string,
  next: (notes: NotesByAccount) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    notesCol(uid),
    (snapshot) => {
      const notes: NotesByAccount = {}
      snapshot.docs.forEach((item) => {
        const data = item.data() as Note & { accountId?: string; date?: string }
        if (!data.accountId || !data.date) return
        const accountNotes = notes[data.accountId] ?? (notes[data.accountId] = {})
        accountNotes[data.date] = {
          text: data.text ?? '',
          updatedAt: data.updatedAt ?? '',
          seeded: data.seeded,
          imageIds: data.imageIds,
        }
      })
      next(notes)
    },
    (error) => onError?.(error),
  )
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

interface WriteOperation {
  type: 'set' | 'delete'
  ref: DocumentReference
  data?: DocumentData
}

async function commit(operations: WriteOperation[]) {
  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = writeBatch(requireDb())
    operations.slice(index, index + BATCH_LIMIT).forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref)
      else batch.set(operation.ref, operation.data ?? {})
    })
    await batch.commit()
  }
}

/** Push only the accounts that were added, edited or removed. */
export async function syncAccounts(uid: string, previous: Account[], next: Account[]): Promise<void> {
  const before = new Map(previous.map((account) => [account.id, account]))
  const after = new Map(next.map((account) => [account.id, account]))
  const operations: WriteOperation[] = []

  next.forEach((account) => {
    const old = before.get(account.id)
    if (!old || !sameValue(old, account)) {
      operations.push({ type: 'set', ref: doc(accountsCol(uid), account.id), data: account })
    }
  })
  previous.forEach((account) => {
    if (!after.has(account.id)) {
      operations.push({ type: 'delete', ref: doc(accountsCol(uid), account.id) })
    }
  })

  if (operations.length) await commit(operations)
}

export async function syncTrades(uid: string, previous: Trade[], next: Trade[]): Promise<void> {
  const before = new Map(previous.map((trade) => [trade.id, trade]))
  const after = new Map(next.map((trade) => [trade.id, trade]))
  const operations: WriteOperation[] = []

  next.forEach((trade) => {
    const old = before.get(trade.id)
    if (!old || !sameValue(old, trade)) {
      operations.push({ type: 'set', ref: doc(tradesCol(uid), trade.id), data: trade })
    }
  })
  previous.forEach((trade) => {
    if (!after.has(trade.id)) {
      operations.push({ type: 'delete', ref: doc(tradesCol(uid), trade.id) })
    }
  })

  if (operations.length) await commit(operations)
}

/** Stable hash so re-saving the same screenshot reuses the same document. */
function hashString(value: string) {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0
  }
  return (hash >>> 0).toString(36) + '-' + value.length.toString(36)
}

/** Firestore documents are capped at 1 MiB; keep images comfortably below it. */
const MAX_IMAGE_DOC_BYTES = 950_000

function imageDocId(accountId: string, date: string, data: string) {
  return `img_${hashString(`${accountId}|${date}|${data}`)}`
}

function imageIdsFor(accountId: string, date: string, images: string[] | undefined): string[] {
  if (!images) return []
  return images
    .filter((image) => image.startsWith('data:'))
    .map((image) => imageDocId(accountId, date, image))
}

const imageCache = new Map<string, string>()

/** Synchronous cache hit, so reopening a note never flickers. */
export function getCachedNoteImages(imageIds: string[]): string[] | null {
  if (!imageIds.length) return []
  if (!imageIds.every((id) => imageCache.has(id))) return null
  return imageIds.map((id) => imageCache.get(id) as string)
}

/** Load screenshot documents on demand, only for the note being opened. */
export async function loadNoteImages(uid: string, imageIds: string[]): Promise<string[]> {
  const cached = getCachedNoteImages(imageIds)
  if (cached) return cached

  const snapshots = await Promise.all(imageIds.map((id) => getDoc(doc(imagesCol(uid), id))))
  const images: string[] = []
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists()) return
    const data = (snapshot.data() as { data?: string }).data
    if (!data) return
    imageCache.set(imageIds[index], data)
    images.push(data)
  })
  return images
}

interface PendingImage {
  id: string
  data: string
}

function collectNewImages(
  accountId: string,
  date: string,
  images: string[] | undefined,
  existingIds: string[],
): PendingImage[] {
  if (!images) return []
  const pending = new Map<string, string>()
  images.forEach((image) => {
    if (!image.startsWith('data:')) return
    if (image.length > MAX_IMAGE_DOC_BYTES) {
      throw new Error('One screenshot is too large to sync. Remove it and attach a smaller image.')
    }
    const id = imageDocId(accountId, date, image)
    imageCache.set(id, image)
    if (!existingIds.includes(id)) pending.set(id, image)
  })
  return Array.from(pending, ([id, data]) => ({ id, data }))
}

async function writeNote(
  uid: string,
  accountId: string,
  date: string,
  note: Note,
  previousImageIds: string[] = [],
) {
  let imageIds = note.imageIds ?? previousImageIds
  let pending: PendingImage[] = []

  if (note.images !== undefined) {
    imageIds = imageIdsFor(accountId, date, note.images)
    pending = collectNewImages(accountId, date, note.images, previousImageIds)
  }

  const operations: WriteOperation[] = pending.map((image) => ({
    type: 'set' as const,
    ref: doc(imagesCol(uid), image.id),
    data: {
      accountId,
      date,
      data: image.data,
      createdAt: new Date().toISOString(),
    },
  }))

  previousImageIds
    .filter((id) => !imageIds.includes(id))
    .forEach((id) => operations.push({ type: 'delete', ref: doc(imagesCol(uid), id) }))

  if (operations.length) await commit(operations)

  await setDoc(doc(notesCol(uid), noteDocId(accountId, date)), {
    accountId,
    date,
    text: note.text,
    updatedAt: note.updatedAt,
    seeded: note.seeded ?? false,
    imageIds,
  })
}

function noteSignature(note: Note) {
  return JSON.stringify({
    text: note.text,
    updatedAt: note.updatedAt,
    seeded: note.seeded ?? false,
    imageIds: note.imageIds ?? null,
  })
}

export async function syncNotes(uid: string, previous: NotesByAccount, next: NotesByAccount): Promise<void> {
  const flatten = (source: NotesByAccount) => {
    const map = new Map<string, { accountId: string; date: string; note: Note }>()
    Object.entries(source).forEach(([accountId, accountNotes]) => {
      Object.entries(accountNotes ?? {}).forEach(([date, note]) => {
        map.set(`${accountId}|${date}`, { accountId, date, note })
      })
    })
    return map
  }

  const before = flatten(previous)
  const after = flatten(next)

  for (const [key, entry] of after) {
    const old = before.get(key)
    if (
      old &&
      entry.note.images === undefined &&
      noteSignature(old.note) === noteSignature(entry.note)
    ) {
      continue
    }
    const previousIds =
      old?.note.imageIds ?? imageIdsFor(entry.accountId, entry.date, old?.note.images)
    await writeNote(uid, entry.accountId, entry.date, entry.note, previousIds)
  }

  for (const [key, entry] of before) {
    if (after.has(key)) continue
    const ids = entry.note.imageIds ?? imageIdsFor(entry.accountId, entry.date, entry.note.images)
    await deleteDoc(doc(notesCol(uid), noteDocId(entry.accountId, entry.date)))
    if (ids.length) {
      await commit(ids.map((id) => ({ type: 'delete' as const, ref: doc(imagesCol(uid), id) })))
    }
  }
}

/** Local cache copy: keep text and ids, never duplicate base64 screenshots. */
export function notesForCache(notes: NotesByAccount): NotesByAccount {
  const result: NotesByAccount = {}
  Object.entries(notes).forEach(([accountId, accountNotes]) => {
    const next: Record<string, Note> = {}
    Object.entries(accountNotes ?? {}).forEach(([date, note]) => {
      const remoteImages = note.images?.filter((image) => !image.startsWith('data:'))
      next[date] = {
        ...note,
        images: remoteImages && remoteImages.length ? remoteImages : undefined,
      }
    })
    result[accountId] = next
  })
  return result
}

/* ------------------------------------------------------------------ */
/* Migration + reset                                                   */
/* ------------------------------------------------------------------ */

export async function pushWorkspaceToCloud(
  uid: string,
  accounts: Account[],
  trades: Trade[],
  notes: NotesByAccount,
): Promise<void> {
  await ensureUserProfile(uid, {})

  const operations: WriteOperation[] = []
  accounts.forEach((account) => {
    operations.push({ type: 'set', ref: doc(accountsCol(uid), account.id), data: account })
  })
  trades.forEach((trade) => {
    operations.push({ type: 'set', ref: doc(tradesCol(uid), trade.id), data: trade })
  })
  if (operations.length) await commit(operations)

  // Notes are written one by one because screenshots live in their own docs.
  for (const [accountId, accountNotes] of Object.entries(notes)) {
    for (const [date, note] of Object.entries(accountNotes ?? {})) {
      await writeNote(uid, accountId, date, note)
    }
  }
}

export async function deleteCloudWorkspace(uid: string): Promise<void> {
  for (const collectionRef of [accountsCol(uid), tradesCol(uid), notesCol(uid), imagesCol(uid)]) {
    const snapshot = await getDocs(collectionRef)
    const operations = snapshot.docs.map((item) => ({
      type: 'delete' as const,
      ref: item.ref,
    }))
    if (operations.length) await commit(operations)
  }
}

export interface WaitlistEntry {
  email: string
  createdAt: string
  source?: string
}

export async function joinWaitlist(email: string): Promise<void> {
  const db = requireDb()
  const normalized = email.trim().toLowerCase()
  await setDoc(
    doc(db, 'waitlist', normalized),
    {
      email: normalized,
      createdAt: new Date().toISOString(),
      source: 'web',
    },
    { merge: true },
  )
}

export async function listWaitlistEntries(): Promise<WaitlistEntry[]> {
  const db = requireDb()
  const snapshot = await getDocs(collection(db, 'waitlist'))
  return snapshot.docs
    .map((item) => item.data() as WaitlistEntry)
    .filter((entry) => Boolean(entry.email))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

