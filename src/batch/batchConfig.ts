import { brc29ProtocolID } from '@bsv/wallet-toolbox-client'
import type { WalletProtocol } from '@bsv/sdk/wallet/Wallet.interfaces'
import { Utils } from '@bsv/sdk'

// Protocol ID for date-based (BRC-29) address derivation — from wallet-toolbox-client
export const BRC29_PROTOCOL_ID = brc29ProtocolID  // [2, '3241645161d8']

// Derivation suffix: base64('legacy') — matches Utils.toBase64(Utils.toArray('legacy', 'utf8'))
// keyID = base64(date) + ' ' + DERIVATION_SUFFIX
export const DERIVATION_SUFFIX = Utils.toBase64(Utils.toArray('legacy', 'utf8'))

// Optional originator domain for wallet calls. Set to your deployment FQDN if required.
export const ADMIN_ORIGINATOR: string | undefined = undefined

// Mountaintops protocol — matches existing App.tsx lines 43-46
export const MOUNTAINTOPS_PROTOCOL_ID: WalletProtocol = [1, 'mountaintops']
export const MOUNTAINTOPS_KEY_ID = '1'

// WoC throttle: minimum ms between requests (~3/s)
export const WOC_MIN_INTERVAL_MS = 340

// Max inputs per batch transaction for mountaintops imports
export const MAX_INPUTS_PER_BATCH_TX = 1000

// How often the internalizer polls IndexedDB for ready records (ms)
export const INTERNALIZER_POLL_INTERVAL_MS = 3000

// Max retries for failed BEEF fetches or internalization
export const MAX_RETRY_COUNT = 3
