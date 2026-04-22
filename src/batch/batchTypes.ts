export type UtxoStatus =
  | 'discovered'
  | 'beef_fetching'
  | 'beef_fetched'
  | 'internalizing'
  | 'internalized'
  | 'error'

export type AddressMode = 'mountaintops' | 'date-based'

export interface BatchUtxo {
  outpoint: string          // "txid.vout" — primary key
  txid: string
  vout: number
  satoshis: number
  address: string
  addressMode: AddressMode
  dateKey?: string          // "2026-04-22" for date-based
  derivationPrefix?: string // base64-encoded date string
  derivationSuffix?: string // keyID suffix for date-based
  status: UtxoStatus
  beefData?: number[]       // serialized Beef.toBinary()
  error?: string
  retryCount: number
  createdAt: number
  updatedAt: number
}

export interface ProgressCounts {
  discovered: number
  beefFetching: number
  beefFetched: number
  internalizing: number
  internalized: number
  error: number
  totalSatoshis: number
  internalizedSatoshis: number
}

export interface AddressInfo {
  address: string
  mode: AddressMode
  dateKey?: string
  derivationPrefix?: string
  derivationSuffix?: string
}

export interface WoCUnspentResult {
  height?: number
  tx_pos: number
  tx_hash: string
  value: number
  isSpentInMempoolTx: boolean
  status: string
}

export interface WoCAddressUnspentAll {
  error: string
  address: string
  script: string
  result: WoCUnspentResult[]
}
