import { Beef, Transaction, WalletClient } from '@bsv/sdk'
import { CreateActionInput, SignActionArgs } from '@bsv/sdk/wallet/Wallet.interfaces'
import {
  getUtxosByStatus,
  getUtxosByStatusAndMode,
  updateUtxoStatus,
  updateUtxosBulk,
} from './batchDb'
import { BatchUtxo } from './batchTypes'
import BatchImporter from './batchImporter'
import {
  INTERNALIZER_POLL_INTERVAL_MS,
  MAX_INPUTS_PER_BATCH_TX,
  MOUNTAINTOPS_PROTOCOL_ID,
  MOUNTAINTOPS_KEY_ID,
} from './batchConfig'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export type InternalizerState = 'idle' | 'running' | 'paused' | 'done' | 'error'

export class InternalizerPipeline {
  private client: WalletClient
  private aborted = false
  private pausePromise: Promise<void> | null = null
  private resumeFn: (() => void) | null = null
  private identityKey: string | null = null
  state: InternalizerState = 'idle'
  onStateChange?: (state: InternalizerState) => void

  constructor(client: WalletClient) {
    this.client = client
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
    this.resume()
  }

  private setState(s: InternalizerState): void {
    this.state = s
    this.onStateChange?.(s)
  }

  private async checkPause(): Promise<void> {
    if (this.pausePromise) await this.pausePromise
  }

  async run(): Promise<void> {
    this.aborted = false
    this.setState('running')

    // Fetch identity key once upfront (used for date-based internalizeAction)
    try {
      const { publicKey } = await this.client.getPublicKey({ identityKey: true })
      this.identityKey = publicKey
    } catch (e) {
      console.warn('[InternalizerPipeline] Could not fetch identity key:', e)
      this.identityKey = 'anyone' // fallback
    }

    // Poll loop — runs until aborted or all work is done
    while (!this.aborted) {
      await this.checkPause()

      const dateBased = await getUtxosByStatusAndMode('beef_fetched', 'date-based')
      const mountaintops = await getUtxosByStatusAndMode('beef_fetched', 'mountaintops')

      if (dateBased.length === 0 && mountaintops.length === 0) {
        // Check if fetcher still has work to do — if so, wait and poll again
        const discovered = await getUtxosByStatus('discovered')
        const fetching = await getUtxosByStatus('beef_fetching')
        if (discovered.length === 0 && fetching.length === 0) {
          // All work is complete
          break
        }
        await delay(INTERNALIZER_POLL_INTERVAL_MS)
        continue
      }

      // Process date-based UTXOs one at a time (each internalizeAction is atomic)
      for (const utxo of dateBased) {
        if (this.aborted) break
        await this.checkPause()
        await this.internalizeOneDateBased(utxo)
      }

      // Process mountaintops UTXOs in batches
      if (!this.aborted && mountaintops.length > 0) {
        await this.checkPause()
        await this.internalizeMountaintopsBatch(mountaintops)
      }

      await delay(INTERNALIZER_POLL_INTERVAL_MS)
    }

    this.setState('done')
  }

  private async internalizeOneDateBased(utxo: BatchUtxo): Promise<void> {
    if (!utxo.beefData || !utxo.derivationPrefix || !utxo.derivationSuffix) {
      await updateUtxoStatus(utxo.outpoint, 'error', {
        error: 'Missing beefData, derivationPrefix, or derivationSuffix',
      })
      return
    }

    await updateUtxoStatus(utxo.outpoint, 'internalizing')

    try {
      const beef = Beef.fromBinary(utxo.beefData)
      const atomicBeef = beef.toBinaryAtomic(utxo.txid)

      const internalizeArgs = {
        tx: atomicBeef,
        outputs: [
          {
            outputIndex: utxo.vout,
            protocol: 'wallet payment' as const,
            paymentRemittance: {
              derivationPrefix: utxo.derivationPrefix,
              derivationSuffix: utxo.derivationSuffix,
              senderIdentityKey: this.identityKey ?? 'anyone',
            },
          },
        ],
        description: 'Batch import legacy payment',
        labels: ['legacy', 'batch-import'],
        seekPermission: false,
      }

      await this.client.internalizeAction(internalizeArgs)

      await updateUtxoStatus(utxo.outpoint, 'internalized')
    } catch (e) {
      console.error(`[InternalizerPipeline] internalizeAction failed for ${utxo.outpoint}:`, e)
      await updateUtxoStatus(utxo.outpoint, 'error', {
        error: (e as Error).message,
        retryCount: (utxo.retryCount ?? 0) + 1,
      })
    }
  }

  private async internalizeMountaintopsBatch(utxos: BatchUtxo[]): Promise<void> {
    // Split into chunks of MAX_INPUTS_PER_BATCH_TX
    const chunks: BatchUtxo[][] = []
    for (let i = 0; i < utxos.length; i += MAX_INPUTS_PER_BATCH_TX) {
      chunks.push(utxos.slice(i, i + MAX_INPUTS_PER_BATCH_TX))
    }

    for (const chunk of chunks) {
      if (this.aborted) break
      await this.checkPause()
      await this.processMountaintopsChunk(chunk)
    }
  }

  private async processMountaintopsChunk(utxos: BatchUtxo[]): Promise<void> {
    const outpoints = utxos.map(u => u.outpoint)
    await updateUtxosBulk(outpoints, 'internalizing')

    let reference: string | undefined
    try {
      // Merge all BEEFs
      const inputBEEF = new Beef()
      for (const utxo of utxos) {
        if (!utxo.beefData) continue
        const partialBeef = Beef.fromBinary(utxo.beefData)
        inputBEEF.mergeBeef(partialBeef)
      }

      // Build inputs array
      const inputs: CreateActionInput[] = utxos.map(utxo => ({
        outpoint: utxo.outpoint,
        inputDescription: 'Batch redeem from the Legacy Bridge',
        unlockingScriptLength: 108,
      }))

      const { signableTransaction } = await this.client.createAction({
        inputBEEF: inputBEEF.toBinary(),
        inputs,
        description: 'Batch import from the Legacy Bridge',
        labels: ['legacy', 'batch-inbound'],
      })

      if (!signableTransaction) {
        throw new Error('createAction did not return signableTransaction')
      }

      reference = signableTransaction.reference
      const tx = Transaction.fromAtomicBEEF(signableTransaction.tx)
      const importer = new BatchImporter(MOUNTAINTOPS_PROTOCOL_ID, MOUNTAINTOPS_KEY_ID)
      const unlocker = importer.unlock(this.client)

      const signActionArgs: SignActionArgs = { reference, spends: {} }
      for (let i = 0; i < inputs.length; i++) {
        const script = await unlocker.sign(tx, i)
        signActionArgs.spends[i] = { unlockingScript: script.toHex() }
      }

      await this.client.signAction(signActionArgs)
      await updateUtxosBulk(outpoints, 'internalized')
    } catch (e) {
      console.error('[InternalizerPipeline] mountaintops batch failed:', e)
      if (reference) {
        try { await this.client.abortAction({ reference }) } catch (abortErr) { console.warn('[InternalizerPipeline] abortAction failed:', abortErr) }
      }
      await updateUtxosBulk(outpoints, 'error', {
        error: (e as Error).message,
      })
    }
  }
}
