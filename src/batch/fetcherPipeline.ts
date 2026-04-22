import { Beef } from '@bsv/sdk'
import { ThrottledWocClient } from './throttledWocClient'
import {
  addUtxo,
  utxoExists,
  updateUtxoStatus,
  updateUtxosBulk,
  getUtxosByStatus,
} from './batchDb'
import { AddressInfo, BatchUtxo } from './batchTypes'
import { MAX_RETRY_COUNT } from './batchConfig'

export type FetcherState = 'idle' | 'running' | 'paused' | 'done' | 'error'

export class FetcherPipeline {
  private wocClient: ThrottledWocClient
  private aborted = false
  private pausePromise: Promise<void> | null = null
  private resumeFn: (() => void) | null = null
  state: FetcherState = 'idle'
  onStateChange?: (state: FetcherState) => void

  constructor(wocClient: ThrottledWocClient) {
    this.wocClient = wocClient
  }

  pause(): void {
    if (this.state !== 'running') return
    this.pausePromise = new Promise(resolve => { this.resumeFn = resolve })
    this.setState('paused')
  }

  resume(): void {
    if (this.state !== 'paused') return
    this.setState('running')
    this.resumeFn?.()
    this.pausePromise = null
    this.resumeFn = null
  }

  cancel(): void {
    this.aborted = true
    this.wocClient.cancel()
    this.resume() // unblock if paused
  }

  private setState(s: FetcherState): void {
    this.state = s
    this.onStateChange?.(s)
  }

  private async checkPause(): Promise<void> {
    if (this.pausePromise) await this.pausePromise
  }

  async run(addresses: AddressInfo[]): Promise<void> {
    this.aborted = false
    this.setState('running')

    try {
      // Phase 1: discover UTXOs for all addresses
      for (const addrInfo of addresses) {
        if (this.aborted) break
        await this.checkPause()
        await this.discoverUtxos(addrInfo)
      }

      if (this.aborted) {
        this.setState('done')
        return
      }

      // Phase 2: fetch BEEFs for all discovered UTXOs
      await this.fetchAllBeefs()

      this.setState('done')
    } catch (e) {
      console.error('[FetcherPipeline] error:', e)
      this.setState('error')
    }
  }

  private async discoverUtxos(addrInfo: AddressInfo): Promise<void> {
    let results
    try {
      results = await this.wocClient.getUnspentAll(addrInfo.address)
    } catch (e) {
      console.error(`[FetcherPipeline] getUnspentAll failed for ${addrInfo.address}:`, e)
      return
    }

    const now = Date.now()
    for (const r of results) {
      if (this.aborted) break
      const outpoint = `${r.tx_hash}.${r.tx_pos}`
      if (await utxoExists(outpoint)) continue

      const utxo: BatchUtxo = {
        outpoint,
        txid: r.tx_hash,
        vout: r.tx_pos,
        satoshis: r.value,
        address: addrInfo.address,
        addressMode: addrInfo.mode,
        dateKey: addrInfo.dateKey,
        derivationPrefix: addrInfo.derivationPrefix,
        derivationSuffix: addrInfo.derivationSuffix,
        status: 'discovered',
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      await addUtxo(utxo)
    }
  }

  private async fetchAllBeefs(): Promise<void> {
    // Loop until no discovered UTXOs remain (or aborted)
    while (!this.aborted) {
      await this.checkPause()
      const discovered = await getUtxosByStatus('discovered')
      if (discovered.length === 0) break

      // Group by txid to deduplicate BEEF fetches
      const txidMap = new Map<string, string[]>() // txid → outpoints[]
      for (const utxo of discovered) {
        const list = txidMap.get(utxo.txid) ?? []
        list.push(utxo.outpoint)
        txidMap.set(utxo.txid, list)
      }

      for (const [txid, outpoints] of txidMap) {
        if (this.aborted) break
        await this.checkPause()

        // Mark all as fetching
        await updateUtxosBulk(outpoints, 'beef_fetching')

        try {
          const beef: Beef = await this.wocClient.fetchBeef(txid)
          const beefData = beef.toBinary()
          await updateUtxosBulk(outpoints, 'beef_fetched', { beefData })
        } catch (e) {
          console.error(`[FetcherPipeline] BEEF fetch failed for ${txid}:`, e)
          // Increment retryCount for each; mark error if maxed out
          for (const outpoint of outpoints) {
            const current = discovered.find(u => u.outpoint === outpoint)
            const retryCount = (current?.retryCount ?? 0) + 1
            const nextStatus = retryCount >= MAX_RETRY_COUNT ? 'error' : 'discovered'
            await updateUtxoStatus(outpoint, nextStatus, {
              error: (e as Error).message,
              retryCount,
            })
          }
        }
      }
    }
  }
}
