import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { WalletClient, PublicKey, Utils } from '@bsv/sdk'
import { useBatchProgress } from './useBatchProgress'
import { ThrottledWocClient } from './throttledWocClient'
import { FetcherPipeline, FetcherState } from './fetcherPipeline'
import { InternalizerPipeline, InternalizerState } from './internalizerPipeline'
import {
  resetStaleStatuses,
  resetErroredUtxos,
  clearAllData,
  getUtxosByStatus,
  hasUnfinishedWork,
} from './batchDb'
import { AddressInfo, AddressMode, BatchUtxo } from './batchTypes'
import {
  BRC29_PROTOCOL_ID,
  DERIVATION_SUFFIX,
  MOUNTAINTOPS_PROTOCOL_ID,
} from './batchConfig'

const client = new WalletClient('auto')

const getCurrentDate = (daysOffset: number): string => {
  const today = new Date()
  today.setDate(today.getDate() - daysOffset)
  return today.toISOString().split('T')[0]
}

export default function BatchModePage() {
  const [addressMode, setAddressMode] = useState<AddressMode>('mountaintops')
  const [daysOffset, setDaysOffset] = useState(0)
  const [currentAddress, setCurrentAddress] = useState<string | null>(null)
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('mainnet')
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [hasResumable, setHasResumable] = useState(false)
  const [errors, setErrors] = useState<BatchUtxo[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const fetcherRef = useRef<FetcherPipeline | null>(null)
  const internalizerRef = useRef<InternalizerPipeline | null>(null)
  const fetcherStateRef = useRef<FetcherState>('idle')
  const internalizerStateRef = useRef<InternalizerState>('idle')

  const progress = useBatchProgress(isRunning || isPaused)

  // On mount: crash recovery and check for resumable work
  useEffect(() => {
    async function init() {
      const { network: n } = await client.getNetwork({})
      setNetwork(n)
      await resetStaleStatuses()
      const resumable = await hasUnfinishedWork()
      setHasResumable(resumable)
      if (resumable) setStatusMsg('Unfinished work found. Click Resume to continue.')
    }
    init().catch(console.error)
  }, [])

  // Derive current address whenever mode or offset changes
  useEffect(() => {
    setCurrentAddress(null)
    async function deriveAddress() {
      try {
        const { network: n } = await client.getNetwork({})
        if (addressMode === 'mountaintops') {
          const { publicKey } = await client.getPublicKey({
            protocolID: MOUNTAINTOPS_PROTOCOL_ID,
            keyID: '1',
            counterparty: 'anyone',
            forSelf: true,
          })
          setCurrentAddress(PublicKey.fromString(publicKey).toAddress(n))
        } else {
          const dateStr = getCurrentDate(daysOffset)
          const prefix = Utils.toBase64(Utils.toArray(dateStr, 'utf8'))
          const keyID = prefix + ' ' + DERIVATION_SUFFIX
          const args = {
            protocolID: BRC29_PROTOCOL_ID,
            keyID,
            counterparty: 'anyone' as const,
            forSelf: true as const,
          }
          const { publicKey } = await client.getPublicKey(args)
          setCurrentAddress(PublicKey.fromString(publicKey).toAddress(n))
        }
      } catch (e) {
        console.error('Address derivation failed:', e)
        setCurrentAddress('(wallet not connected)')
      }
    }
    deriveAddress()
  }, [addressMode, daysOffset])

  const buildAddresses = useCallback(async (): Promise<AddressInfo[]> => {
    const { network: n } = await client.getNetwork({})
    if (addressMode === 'mountaintops') {
      const { publicKey } = await client.getPublicKey({
        protocolID: MOUNTAINTOPS_PROTOCOL_ID,
        keyID: '1',
        counterparty: 'anyone',
        forSelf: true,
      })
      return [{
        address: PublicKey.fromString(publicKey).toAddress(n),
        mode: 'mountaintops',
      }]
    } else {
      // Scan only the currently selected date
      const addresses: AddressInfo[] = []
      const dateStr = getCurrentDate(daysOffset)
      const prefix = Utils.toBase64(Utils.toArray(dateStr, 'utf8'))
      const keyID = prefix + ' ' + DERIVATION_SUFFIX
      const args = {
        protocolID: BRC29_PROTOCOL_ID,
        keyID,
        counterparty: 'anyone' as const,
        forSelf: true as const,
      }
      const { publicKey } = await client.getPublicKey(args)
      addresses.push({
        address: PublicKey.fromString(publicKey).toAddress(n),
        mode: 'date-based',
        dateKey: dateStr,
        derivationPrefix: prefix,
        derivationSuffix: DERIVATION_SUFFIX,
      })
      return addresses
    }
  }, [addressMode, daysOffset])

  const startPipelines = useCallback(async (addresses: AddressInfo[]) => {
    const wocNetwork = network === 'mainnet' ? 'main' : 'test'
    const wocClient = new ThrottledWocClient(wocNetwork)

    const fetcher = new FetcherPipeline(wocClient)
    const internalizer = new InternalizerPipeline(client)

    fetcher.onStateChange = (s) => {
      fetcherStateRef.current = s
      if (s === 'done' || s === 'error') checkBothDone()
    }
    internalizer.onStateChange = (s) => {
      internalizerStateRef.current = s
      if (s === 'done' || s === 'error') checkBothDone()
    }

    fetcherRef.current = fetcher
    internalizerRef.current = internalizer

    setIsRunning(true)
    setIsPaused(false)
    setStatusMsg('Running...')

    // Run both concurrently; internalizer polls until fetcher is done
    Promise.allSettled([
      fetcher.run(addresses),
      internalizer.run(),
    ]).then(() => {
      setIsRunning(false)
      setStatusMsg('Complete!')
      setHasResumable(false)
      refreshErrors()
    })
  }, [network])

  function checkBothDone() {
    if (
      fetcherStateRef.current !== 'running' &&
      fetcherStateRef.current !== 'paused' &&
      internalizerStateRef.current !== 'running' &&
      internalizerStateRef.current !== 'paused'
    ) {
      // Both pipelines finished — internalizer will naturally exit its loop
    }
  }

  const handleStart = async () => {
    if (isRunning) return
    setStatusMsg('Deriving addresses...')
    try {
      const addresses = await buildAddresses()
      await startPipelines(addresses)
    } catch (e) {
      setStatusMsg(`Error: ${(e as Error).message}`)
    }
  }

  const handleResume = async () => {
    if (isRunning) return
    if (hasResumable) {
      // Re-derive addresses and restart pipelines; fetcher is idempotent (skips existing)
      await handleStart()
    }
  }

  const handlePause = () => {
    fetcherRef.current?.pause()
    internalizerRef.current?.pause()
    setIsPaused(true)
    setStatusMsg('Paused.')
  }

  const handleUnpause = () => {
    fetcherRef.current?.resume()
    internalizerRef.current?.resume()
    setIsPaused(false)
    setStatusMsg('Running...')
  }

  const handleCancel = () => {
    fetcherRef.current?.cancel()
    internalizerRef.current?.cancel()
    setIsRunning(false)
    setIsPaused(false)
    setStatusMsg('Cancelled.')
    setHasResumable(true)
    refreshErrors()
  }

  const handleReset = async () => {
    handleCancel()
    await clearAllData()
    setHasResumable(false)
    setErrors([])
    setStatusMsg('Reset complete.')
  }

  const handleRetryErrors = async () => {
    const count = await resetErroredUtxos()
    setErrors([])
    setStatusMsg(`${count} errored items queued for retry.`)
    setHasResumable(true)
  }

  const refreshErrors = async () => {
    const errs = await getUtxosByStatus('error')
    setErrors(errs)
  }

  // Calculate totals for display
  const total = progress.discovered + progress.beefFetching + progress.beefFetched +
    progress.internalizing + progress.internalized + progress.error
  const fetcherDone = progress.beefFetched + progress.internalizing +
    progress.internalized + progress.error
  const fetcherPct = total > 0 ? Math.round((fetcherDone / total) * 100) : 0
  const internalizerPct = fetcherDone > 0
    ? Math.round((progress.internalized / fetcherDone) * 100)
    : 0

  return (
    <div style={s.container}>
      <div style={s.header}>
        <Link to="/" style={s.backLink}>← Back to Legacy Bridge</Link>
        <h1 style={s.title}>Batch Mode</h1>
        <p style={s.subtitle}>Long-running import for thousands of UTXOs</p>
      </div>

      {/* Address mode selector */}
      <div style={s.card}>
        <h3 style={s.sectionTitle}>Address Mode</h3>
        <div style={s.toggleRow}>
          <button
            style={{ ...s.toggleBtn, ...(addressMode === 'mountaintops' ? s.toggleActive : {}) }}
            onClick={() => setAddressMode('mountaintops')}
            disabled={isRunning}
          >
            Mountaintops
          </button>
          <button
            style={{ ...s.toggleBtn, ...(addressMode === 'date-based' ? s.toggleActive : {}) }}
            onClick={() => setAddressMode('date-based')}
            disabled={isRunning}
          >
            Date-Based (BRC-29)
          </button>
        </div>

        {addressMode === 'date-based' && (
          <div style={s.dateNav}>
            <button style={s.arrowBtn} onClick={() => setDaysOffset(d => d + 1)} disabled={isRunning}>◀</button>
            <span style={s.dateLabel}>{getCurrentDate(daysOffset)}</span>
            <button style={s.arrowBtn} onClick={() => setDaysOffset(d => Math.max(0, d - 1))} disabled={isRunning}>▶</button>
            <span style={s.offsetLabel}>{daysOffset === 0 ? '(today)' : `${daysOffset} day${daysOffset !== 1 ? 's' : ''} ago`}</span>
          </div>
        )}

        {addressMode === 'date-based' && (
          <p style={s.hint}>Scanning address for {getCurrentDate(daysOffset)}</p>
        )}

        <div style={s.addressBox}>
          <span style={s.addressLabel}>Current address: </span>
          <span style={s.addressValue}>{currentAddress ?? 'Deriving...'}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={s.card}>
        <h3 style={s.sectionTitle}>Controls</h3>
        <div style={s.controlRow}>
          {!isRunning && !hasResumable && (
            <button style={s.btn} onClick={handleStart}>Start</button>
          )}
          {!isRunning && hasResumable && (
            <>
              <button style={s.btn} onClick={handleStart}>Start Fresh</button>
              <button style={{ ...s.btn, ...s.btnGreen }} onClick={handleResume}>Resume</button>
            </>
          )}
          {isRunning && !isPaused && (
            <button style={{ ...s.btn, ...s.btnYellow }} onClick={handlePause}>Pause</button>
          )}
          {isRunning && isPaused && (
            <button style={{ ...s.btn, ...s.btnGreen }} onClick={handleUnpause}>Resume</button>
          )}
          {isRunning && (
            <button style={{ ...s.btn, ...s.btnRed }} onClick={handleCancel}>Cancel</button>
          )}
          {!isRunning && (
            <button style={{ ...s.btn, ...s.btnGray }} onClick={handleReset}>Reset All</button>
          )}
        </div>
        {statusMsg && <p style={s.statusMsg}>{statusMsg}</p>}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div style={s.card}>
          <h3 style={s.sectionTitle}>Progress</h3>

          <div style={s.progressSection}>
            <div style={s.progressLabel}>
              <span>Fetcher</span>
              <span>{fetcherDone} / {total} UTXOs ({fetcherPct}%)</span>
            </div>
            <ProgressBar pct={fetcherPct} />
            <div style={s.progressDetail}>
              Discovered: {progress.discovered} &nbsp;|&nbsp;
              Fetching BEEF: {progress.beefFetching} &nbsp;|&nbsp;
              Ready: {progress.beefFetched}
            </div>
          </div>

          <div style={{ ...s.progressSection, marginTop: 20 }}>
            <div style={s.progressLabel}>
              <span>Internalizer</span>
              <span>{progress.internalized} / {fetcherDone} ({internalizerPct}%)</span>
            </div>
            <ProgressBar pct={internalizerPct} color="#38a169" />
            <div style={s.progressDetail}>
              Internalizing: {progress.internalizing} &nbsp;|&nbsp;
              Done: {progress.internalized} &nbsp;|&nbsp;
              Errors: {progress.error}
            </div>
          </div>

          <div style={s.satoshisSummary}>
            <div style={s.satRow}>
              <span>Found:</span>
              <strong>{(progress.totalSatoshis / 1e8).toFixed(8)} BSV</strong>
            </div>
            <div style={s.satRow}>
              <span>Imported:</span>
              <strong style={{ color: '#38a169' }}>{(progress.internalizedSatoshis / 1e8).toFixed(8)} BSV</strong>
            </div>
            <div style={s.satRow}>
              <span>Remaining:</span>
              <strong style={{ color: '#e53e3e' }}>
                {((progress.totalSatoshis - progress.internalizedSatoshis) / 1e8).toFixed(8)} BSV
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {progress.error > 0 && (
        <div style={s.card}>
          <div style={s.errorHeader}>
            <h3 style={{ ...s.sectionTitle, margin: 0 }}>
              Errors ({progress.error})
            </h3>
            <div style={s.errorActions}>
              <button style={{ ...s.btn, ...s.btnSmall }} onClick={handleRetryErrors}>
                Retry All
              </button>
              <button style={{ ...s.btn, ...s.btnSmall, ...s.btnGray }} onClick={() => {
                setShowErrors(v => !v)
                if (!showErrors) refreshErrors()
              }}>
                {showErrors ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {showErrors && (
            <ul style={s.errorList}>
              {errors.slice(0, 20).map(e => (
                <li key={e.outpoint} style={s.errorItem}>
                  <code style={s.code}>{e.outpoint}</code>
                  <span style={s.errorMsg}>{e.error ?? 'unknown error'}</span>
                  <span style={s.retryCount}>retries: {e.retryCount}</span>
                </li>
              ))}
              {errors.length > 20 && (
                <li style={s.errorItem}>...and {errors.length - 20} more</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Config note */}
      <div style={s.card}>
        <h3 style={s.sectionTitle}>Configuration</h3>
        <p style={s.hint}>
          Date-based derivation uses <code>DERIVATION_SUFFIX</code> and <code>BRC29_PROTOCOL_ID</code> from{' '}
          <code>src/batch/batchConfig.ts</code>. Confirm these match your deployment before running.
        </p>
        <p style={s.hint}>Network: <strong>{network}</strong></p>
      </div>
    </div>
  )
}

function ProgressBar({ pct, color = '#3182ce' }: { pct: number; color?: string }) {
  return (
    <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: 4, height: 18, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, pct)}%`,
        backgroundColor: color,
        height: 18,
        borderRadius: 4,
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`,
    color: '#2c3e50',
    backgroundColor: '#f5f7fa',
    minHeight: '100vh',
    padding: '0 0 60px',
  },
  header: {
    backgroundColor: '#2c5282',
    color: '#fff',
    padding: '24px 20px 20px',
    textAlign: 'center',
  },
  backLink: {
    color: '#bee3f8',
    textDecoration: 'none',
    fontSize: '0.9rem',
    display: 'block',
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 600,
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: '1rem',
    color: '#bee3f8',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid #e1e8ed',
    padding: 24,
    margin: '24px auto',
    maxWidth: 700,
    width: '90%',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#2c5282',
    marginBottom: 14,
    marginTop: 0,
  },
  toggleRow: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 16,
  },
  toggleBtn: {
    padding: '8px 20px',
    borderRadius: 4,
    border: '2px solid #3182ce',
    backgroundColor: '#fff',
    color: '#3182ce',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  toggleActive: {
    backgroundColor: '#3182ce',
    color: '#fff',
  },
  dateNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  arrowBtn: {
    backgroundColor: '#edf2f7',
    border: '1px solid #cbd5e0',
    borderRadius: 4,
    padding: '6px 14px',
    fontSize: '1rem',
    cursor: 'pointer',
    color: '#2c5282',
  },
  dateLabel: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#2c5282',
    minWidth: 120,
    textAlign: 'center',
  },
  offsetLabel: {
    fontSize: '0.85rem',
    color: '#718096',
  },
  hint: {
    fontSize: '0.85rem',
    color: '#718096',
    margin: '8px 0',
    textAlign: 'center',
  },
  addressBox: {
    backgroundColor: '#edf2f7',
    borderRadius: 4,
    padding: '10px 14px',
    marginTop: 12,
    fontSize: '0.85rem',
    overflowWrap: 'break-word',
    textAlign: 'left',
  },
  addressLabel: {
    fontWeight: 600,
    color: '#4a5568',
    marginRight: 6,
  },
  addressValue: {
    color: '#2c5282',
    fontFamily: 'monospace',
  },
  controlRow: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  btn: {
    padding: '10px 22px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#3182ce',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnSmall: {
    padding: '6px 14px',
    fontSize: '0.85rem',
  },
  btnGreen: { backgroundColor: '#38a169' },
  btnYellow: { backgroundColor: '#d69e2e' },
  btnRed: { backgroundColor: '#e53e3e' },
  btnGray: { backgroundColor: '#718096' },
  statusMsg: {
    textAlign: 'center',
    color: '#4a5568',
    fontSize: '0.9rem',
    margin: '8px 0 0',
  },
  progressSection: {
    marginBottom: 8,
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    color: '#4a5568',
    marginBottom: 6,
  },
  progressDetail: {
    fontSize: '0.8rem',
    color: '#718096',
    marginTop: 4,
    textAlign: 'center',
  },
  satoshisSummary: {
    marginTop: 20,
    borderTop: '1px solid #e2e8f0',
    paddingTop: 14,
    display: 'flex',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 10,
  },
  satRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.9rem',
    color: '#4a5568',
  },
  errorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  errorActions: {
    display: 'flex',
    gap: 8,
  },
  errorList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  errorItem: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: 4,
    padding: '8px 12px',
    marginBottom: 6,
    fontSize: '0.82rem',
    color: '#4a5568',
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: 8,
    alignItems: 'center',
  },
  code: {
    fontFamily: 'monospace',
    color: '#2c5282',
    fontSize: '0.78rem',
    overflowWrap: 'break-word',
    wordBreak: 'break-all',
  },
  errorMsg: {
    color: '#e53e3e',
    textAlign: 'right',
  },
  retryCount: {
    color: '#718096',
    whiteSpace: 'nowrap',
  },
}
