import { openDB, IDBPDatabase } from 'idb'
import { BatchUtxo, ProgressCounts, UtxoStatus } from './batchTypes'

const DB_NAME = 'legacy-bridge-batch'
const DB_VERSION = 1
const STORE = 'utxos'

interface BatchDbSchema {
  utxos: {
    key: string
    value: BatchUtxo
    indexes: {
      byStatus: string
      byAddressMode: string
      byStatusAndMode: [string, string]
    }
  }
}

let dbPromise: Promise<IDBPDatabase<BatchDbSchema>> | null = null

function getDb(): Promise<IDBPDatabase<BatchDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BatchDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'outpoint' })
        store.createIndex('byStatus', 'status')
        store.createIndex('byAddressMode', 'addressMode')
        store.createIndex('byStatusAndMode', ['status', 'addressMode'])
      },
    })
  }
  return dbPromise
}

export async function addUtxo(utxo: BatchUtxo): Promise<void> {
  const db = await getDb()
  await db.put(STORE, utxo)
}

export async function utxoExists(outpoint: string): Promise<boolean> {
  const db = await getDb()
  const record = await db.get(STORE, outpoint)
  return record !== undefined
}

export async function updateUtxoStatus(
  outpoint: string,
  status: UtxoStatus,
  extra?: Partial<BatchUtxo>
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE, 'readwrite')
  const record = await tx.store.get(outpoint)
  if (record) {
    await tx.store.put({ ...record, ...extra, status, updatedAt: Date.now() })
  }
  await tx.done
}

export async function updateUtxosBulk(
  outpoints: string[],
  status: UtxoStatus,
  extra?: Partial<BatchUtxo>
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE, 'readwrite')
  for (const outpoint of outpoints) {
    const record = await tx.store.get(outpoint)
    if (record) {
      await tx.store.put({ ...record, ...extra, status, updatedAt: Date.now() })
    }
  }
  await tx.done
}

export async function getUtxosByStatus(status: UtxoStatus): Promise<BatchUtxo[]> {
  const db = await getDb()
  return db.getAllFromIndex(STORE, 'byStatus', status)
}

export async function getUtxosByStatusAndMode(
  status: UtxoStatus,
  mode: string
): Promise<BatchUtxo[]> {
  const db = await getDb()
  return db.getAllFromIndex(STORE, 'byStatusAndMode', [status, mode])
}

export async function getProgressCounts(): Promise<ProgressCounts> {
  const db = await getDb()
  const all = await db.getAll(STORE)

  const counts: ProgressCounts = {
    discovered: 0,
    beefFetching: 0,
    beefFetched: 0,
    internalizing: 0,
    internalized: 0,
    error: 0,
    totalSatoshis: 0,
    internalizedSatoshis: 0,
  }

  for (const utxo of all) {
    counts.totalSatoshis += utxo.satoshis
    switch (utxo.status) {
      case 'discovered':     counts.discovered++;   break
      case 'beef_fetching':  counts.beefFetching++; break
      case 'beef_fetched':   counts.beefFetched++;  break
      case 'internalizing':  counts.internalizing++; break
      case 'internalized':
        counts.internalized++
        counts.internalizedSatoshis += utxo.satoshis
        break
      case 'error':          counts.error++;        break
    }
  }

  return counts
}

// On crash recovery: reset in-flight statuses back to retryable states
export async function resetStaleStatuses(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE, 'readwrite')
  let cursor = await tx.store.openCursor()
  while (cursor) {
    if (cursor.value.status === 'beef_fetching') {
      await cursor.update({ ...cursor.value, status: 'discovered', updatedAt: Date.now() })
    } else if (cursor.value.status === 'internalizing') {
      await cursor.update({ ...cursor.value, status: 'beef_fetched', updatedAt: Date.now() })
    }
    cursor = await cursor.continue()
  }
  await tx.done
}

// Reset errored UTXOs back to retryable state
export async function resetErroredUtxos(): Promise<number> {
  const errored = await getUtxosByStatus('error')
  const db = await getDb()
  const tx = db.transaction(STORE, 'readwrite')
  for (const utxo of errored) {
    const nextStatus: UtxoStatus = utxo.beefData ? 'beef_fetched' : 'discovered'
    await tx.store.put({
      ...utxo,
      status: nextStatus,
      error: undefined,
      updatedAt: Date.now(),
    })
  }
  await tx.done
  return errored.length
}

// Check if there is any unfinished work
export async function hasUnfinishedWork(): Promise<boolean> {
  const db = await getDb()
  const unfinishedStatuses: UtxoStatus[] = ['discovered', 'beef_fetching', 'beef_fetched', 'internalizing', 'error']
  for (const status of unfinishedStatuses) {
    const records = await db.getAllFromIndex(STORE, 'byStatus', status)
    if (records.length > 0) return true
  }
  return false
}

// Clear all data (for reset)
export async function clearAllData(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE)
}
