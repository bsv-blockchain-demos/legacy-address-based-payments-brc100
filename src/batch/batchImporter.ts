import ScriptTemplate from '@bsv/sdk/script/ScriptTemplate'
import LockingScript from '@bsv/sdk/script/LockingScript'
import UnlockingScript from '@bsv/sdk/script/UnlockingScript'
import Signature from '@bsv/sdk/primitives/Signature'
import Transaction from '@bsv/sdk/transaction/Transaction'
import TransactionSignature from '@bsv/sdk/primitives/TransactionSignature'
import { sha256 } from '@bsv/sdk/primitives/Hash'
import { WalletInterface } from '@bsv/sdk/wallet/Wallet.interfaces'
import { toArray } from '@bsv/sdk/primitives/utils'
import { WalletProtocol } from '@bsv/sdk/wallet/Wallet.interfaces'

function verifyTruthy<T>(v: T | undefined): T {
  if (v == null) throw new Error('must have value')
  return v
}

// Parameterized version of Importer — accepts any protocolID/keyID rather than
// hardcoding [1, 'mountaintops'] / '1'. Used by the batch pipeline for mountaintops imports.
export default class BatchImporter implements ScriptTemplate {
  private protocolID: WalletProtocol
  private keyID: string

  constructor(protocolID: WalletProtocol = [1, 'mountaintops'], keyID: string = '1') {
    this.protocolID = protocolID
    this.keyID = keyID
  }

  lock!: () => LockingScript | Promise<LockingScript>

  unlock(client: WalletInterface): {
    sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>
    estimateLength: () => Promise<108>
  } {
    const protocolID = this.protocolID
    const keyID = this.keyID
    return {
      sign: async (tx: Transaction, inputIndex: number) => {
        let signatureScope = TransactionSignature.SIGHASH_FORKID
        signatureScope |= TransactionSignature.SIGHASH_ALL
        const input = tx.inputs[inputIndex]
        const otherInputs = tx.inputs.filter((_, i) => i !== inputIndex)
        const sourceTXID = input.sourceTXID ?? input.sourceTransaction?.id('hex')
        if (!sourceTXID) {
          throw new Error('sourceTXID or sourceTransaction required for signing')
        }
        const sourceSatoshis =
          input.sourceTransaction?.outputs[input.sourceOutputIndex].satoshis
        if (sourceSatoshis == null) {
          throw new Error('sourceSatoshis required for signing')
        }
        const lockingScript =
          input.sourceTransaction?.outputs[input.sourceOutputIndex].lockingScript
        if (lockingScript == null) {
          throw new Error('lockingScript required for signing')
        }

        const preimage = TransactionSignature.format({
          sourceTXID,
          sourceOutputIndex: verifyTruthy(input.sourceOutputIndex),
          sourceSatoshis,
          transactionVersion: tx.version,
          otherInputs,
          inputIndex,
          outputs: tx.outputs,
          inputSequence: verifyTruthy(input.sequence),
          subscript: lockingScript,
          lockTime: tx.lockTime,
          scope: signatureScope,
        })

        const hashToSign = sha256(sha256(preimage))
        const { signature } = await client.createSignature({
          hashToDirectlySign: hashToSign,
          protocolID,
          keyID,
          counterparty: 'anyone',
        })
        const rawSignature = Signature.fromDER(signature)
        const sig = new TransactionSignature(rawSignature.r, rawSignature.s, signatureScope)
        const sigForScript = sig.toChecksigFormat()
        const { publicKey } = await client.getPublicKey({
          protocolID,
          keyID,
          counterparty: 'anyone',
          forSelf: true,
        })
        const pubkeyForScript = toArray(publicKey, 'hex')
        return new UnlockingScript([
          { op: sigForScript.length, data: sigForScript },
          { op: pubkeyForScript.length, data: pubkeyForScript },
        ])
      },
      estimateLength: async () => 108,
    }
  }
}
