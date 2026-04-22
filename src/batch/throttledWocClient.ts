import { Beef } from '@bsv/sdk'
import getBeefForTxid from '../getBeefForTxid'
import { WoCAddressUnspentAll, WoCUnspentResult } from './batchTypes'
import { WOC_MIN_INTERVAL_MS } from './batchConfig'

export class ThrottledWocClient {
  private queue: Array<() => Promise<void>> = []
  private processing = false
  private lastRequestTime = 0
  private cancelled = false
  private network: 'main' | 'test'

  constructor(network: 'main' | 'test') {
    this.network = network
  }

  cancel(): void {
    this.cancelled = true
    this.queue = []
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0 && !this.cancelled) {
      const now = Date.now()
      const elapsed = now - this.lastRequestTime
      if (elapsed < WOC_MIN_INTERVAL_MS) {
        await delay(WOC_MIN_INTERVAL_MS - elapsed)
      }

      const job = this.queue.shift()
      if (job) {
        this.lastRequestTime = Date.now()
        await job()
      }
    }

    this.processing = false
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.cancelled) {
        reject(new Error('Client cancelled'))
        return
      }
      this.queue.push(async () => {
        try {
          resolve(await fn())
        } catch (e) {
          reject(e)
        }
      })
      this.processQueue()
    })
  }

  async getUnspentAll(address: string): Promise<WoCUnspentResult[]> {
    return this.enqueue(async () => {
      const response = await fetch(
        `https://api.whatsonchain.com/v1/bsv/${this.network}/address/${address}/unspent/all`
      )
      if (!response.ok) {
        throw new Error(`WoC unspent/all failed: ${response.status} ${response.statusText}`)
      }
      const data: WoCAddressUnspentAll = await response.json()
      if (data.error && data.error !== '') {
        throw new Error(`WoC error: ${data.error}`)
      }
      return (data.result || []).filter(r => !r.isSpentInMempoolTx)
    })
  }

  async fetchBeef(txid: string): Promise<Beef> {
    return this.enqueue(() => getBeefForTxid(txid, this.network))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
