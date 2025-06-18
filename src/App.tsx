import { useState } from 'react';
import WalletClient from '@bsv/sdk/wallet/WalletClient';
import PublicKey from '@bsv/sdk/primitives/PublicKey';
import P2PKH from '@bsv/sdk/script/templates/P2PKH';
import { CreateActionInput, SignActionArgs } from '@bsv/sdk/wallet/Wallet.interfaces';
import Importer from './Importer';
import Transaction from '@bsv/sdk/transaction/Transaction';
import { Beef } from '@bsv/sdk/transaction/Beef';
import { useMNCErrorHandler } from 'metanet-react-prompt';
import getBeefForTxid from './getBeefForTxid';
import { QRCodeSVG } from 'qrcode.react';

// Instantiate a new BSV WalletClient (auto-detects wallet environment).
const client = new WalletClient('auto');

// Main Component
const Mountaintops: React.FC = () => {
    const handleMNCError = useMNCErrorHandler()
    const [mountaintopsAddress, setMountaintopsAddress] = useState<string | null>(null);
    const [balance, setBalance] = useState<number>(-1);
    const [recipientAddress, setRecipientAddress] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [transactions, setTransactions] = useState<
        Array<{ txid: string; to: string; amount: string }>
    >([]);
    const [isImporting, setIsImporting] = useState<boolean>(false);

    // Fetch the real wallet network
    const getRealWalletNetwork = async (): Promise<'mainnet' | 'testnet'> => {
        try {
            const { network } = await client.getNetwork({});
            return network;
        } catch (e) {
            handleMNCError(e as Error)
            throw e
        }
    };

    // Derive a public "Mountaintops" address (publicly exposed in this app)
    const getMountaintopsAddress = async (): Promise<string> => {
        const network = await getRealWalletNetwork();
        const { publicKey } = await client.getPublicKey({
            protocolID: [1, 'mountaintops'],
            keyID: '1',
            counterparty: 'anyone',
            forSelf: true,
        });
        return PublicKey.fromString(publicKey).toAddress(network);
    };

    interface Utxo {
        txid: string;
        vout: number;
        satoshis: number;
    }

    interface WoCAddressUnspentAll {
        error: string,
        address: string,
        script: string,
        result: {
            height?: number,
            tx_pos: number,
            tx_hash: string,
            value: number,
            isSpentInMempoolTx: boolean,
            status: string
        }[]
    }

    const getUtxosForAddress = async (address: string): Promise<Utxo[]> => {
        const network = await getRealWalletNetwork();
        const response = await fetch(
            `https://api.whatsonchain.com/v1/bsv/${network === 'mainnet' ? 'main' : 'test'
            }/address/${address}/unspent/all`
        );
        const rp: WoCAddressUnspentAll = await response.json();
        const utxos: Utxo[] = rp.result.filter(r => r.isSpentInMempoolTx === false).map(r => ({ txid: r.tx_hash, vout: r.tx_pos, satoshis: r.value }));
        return utxos
    }

    // Fetch BSV balance for a given address
    const fetchBSVBalance = async (address: string): Promise<number> => {
        const utxos = await getUtxosForAddress(address);
        const balance = utxos.reduce((acc, r) => acc + r.satoshis, 0);
        return balance / 100000000;
    };

    // Send BSV to a recipient address
    const sendBSV = async (to: string, amount: number): Promise<string | undefined> => {
        const network = await getRealWalletNetwork();
        // Very naive network vs. address check for demo:
        if (network === 'mainnet' && !to.startsWith('1')) {
            alert('You are on mainnet but the recipient address does not look like a mainnet address (starting with 1)!');
            return;
        }

        const lockingScript = new P2PKH().lock(to).toHex();
        const { txid } = await client.createAction({
            description: 'Shout BSV at an address',
            outputs: [
                {
                    lockingScript,
                    satoshis: Math.round(amount * 100000000),
                    outputDescription: 'BSV for recipient address',
                },
            ],
        });
        return txid;
    };

    // Show your address
    const handleViewAddress = async () => {
        setMountaintopsAddress(await getMountaintopsAddress());
    };

    // Get your balance
    const handleGetBalance = async () => {
        if (mountaintopsAddress) {
            const fetchedBalance = await fetchBSVBalance(mountaintopsAddress);
            setBalance(fetchedBalance);
        } else {
            alert('Get your address first!');
        }
    };

    // Import funds from the "Mountaintops" address
    const handleImportFunds = async () => {
        if (!mountaintopsAddress || balance < 0) {
            alert('Get your address and balance first!');
            return;
        }
        if (balance === 0) {
            alert('No money to import!');
            return;
        }
        
        // Set loading state
        setIsImporting(true);

        let reference: string | undefined = undefined;
        try {
            const network = await getRealWalletNetwork();
            const utxos = await getUtxosForAddress(mountaintopsAddress);

            const outpoints: string[] = utxos.map(x => `${x.txid}.${x.vout}`)
            const inputs: CreateActionInput[] = outpoints.map(outpoint => ({
                outpoint,
                inputDescription: 'Redeem from the Legacy Bridge',
                unlockingScriptLength: 108,
            }));

            // Merge BEEF for the inputs (placeholder)
            const inputBEEF = new Beef();
            for (let i = 0; i < inputs.length; i++) {
                const txid = inputs[i].outpoint.split('.')[0];
                if (!inputBEEF.findTxid(txid)) {
                    const beef = await getBeefForTxid(txid, network === 'mainnet' ? 'main' : 'test')
                    inputBEEF.mergeBeef(beef);
                }
            }

            // Create the action for spending from these inputs
            const { signableTransaction } = await client.createAction({
                inputBEEF: inputBEEF.toBinary(),
                inputs,
                description: 'Import from the Legacy Bridge',
            });

            reference = signableTransaction!.reference;

            // Convert BEEF to a Transaction object
            const tx = Transaction.fromAtomicBEEF(signableTransaction!.tx);
            const importer = new Importer();
            const unlocker = importer.unlock(client);

            const signActionArgs: SignActionArgs = {
                reference,
                spends: {},
            };

            // Sign each input
            for (let i = 0; i < inputs.length; i++) {
                const script = await unlocker.sign(tx, i);
                signActionArgs.spends[i] = {
                    unlockingScript: script.toHex(),
                };
            }

            // Broadcast signatures back to the wallet
            await client.signAction(signActionArgs);

            // Reset the local balance after successful import
            setBalance(0);
            alert('Funds successfully imported to your local wallet!');
        } catch (e) {
            console.error(e)
            // Abort in case something goes wrong
            if (reference) {
                await client.abortAction({ reference });
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const message = `Import failed: ${(e as any).message || 'unknown error'}`;
            alert(message);
        } finally {
            // Reset loading state regardless of outcome
            setIsImporting(false);
        }
    };

    // SHOUT BSV to someone
    const handleShoutBSV = async () => {
        if (!recipientAddress || !amount) {
            alert('Please enter a recipient address AND an amount first!');
            return;
        }

        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0) {
            alert('Please enter a valid amount > 0.');
            return;
        }

        const txid = await sendBSV(recipientAddress, amt);
        if (txid) {
            alert(
                `Successfully sent ${amt} BSV from your wallet to ${recipientAddress} TXID: ${txid}`
            );

            // Record the transaction locally
            setTransactions((prev) => [
                ...prev,
                {
                    txid,
                    to: recipientAddress,
                    amount: amt.toString(),
                },
            ]);
            setRecipientAddress('');
            setAmount('');
        }
    };

    return (
        <div style={styles.container}>
            {/* Main content panel */}
                <h1 style={styles.title}>Legacy Bridge</h1>
                <p style={styles.subtitle}>
                    Address Based BSV Payments to and from BRC-100 Wallets
                </p>

                <div style={styles.content}>
                {/* Address and balance section */}
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Receive</h3>
                    {!mountaintopsAddress ? (
                        <button style={styles.actionButton} onClick={handleViewAddress}>
                            Show Address
                        </button>
                    ) : (
                        <>
                            <p style={styles.label}>Your Address:</p>
                            <div style={styles.addressBox}>{mountaintopsAddress}</div>
                            <div style={styles.qrCodeContainer}>
                                <QRCodeSVG value={mountaintopsAddress || ''} size={150} bgColor="#ffffff" fgColor="#2c5282" />
                            </div>

                            <div style={styles.buttonsRow}>
                                <button style={styles.actionButton} onClick={handleGetBalance}>
                                    Get Balance
                                </button>
                                <button 
                                    style={{
                                        ...styles.actionButton,
                                        ...(isImporting ? styles.disabledButton : {})
                                    }} 
                                    onClick={handleImportFunds}
                                    disabled={isImporting}
                                >
                                    {isImporting ? 'Importing...' : 'Import Funds'}
                                </button>
                            </div>

                            <p style={styles.balanceText}>
                                BSV available from this address:{' '}
                                {balance === -1
                                    ? 'Not checked yet!'
                                    : `${balance} BSV`}
                            </p>
                        </>
                    )}
                </div>
            </div>
            <div style={styles.content}>
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>
                        Send
                    </h3>
                    <input
                        style={styles.input}
                        placeholder="Recipient Address"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                    />
                    <input
                        style={styles.input}
                        placeholder="Amount (BSV)"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                    <button style={{ ...styles.actionButton, ...styles.shoutButton }} onClick={handleShoutBSV}>
                        Send
                    </button>
                </div>
            </div>
            <div style={styles.content}>
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>History</h3>
                    {transactions.length === 0 ? (
                        <p style={styles.emptyState}>
                            No transactions yet...
                        </p>
                    ) : (
                        <ul style={styles.txList}>
                            {transactions.map((tx, index) => (
                                <li key={index} style={styles.txListItem}>
                                    <strong>TXID:</strong> <a style={styles.link} href={`https://whatsonchain.com/tx/${tx.txid}`} target="_blank" rel="noopener noreferrer">{tx.txid}</a>
                                    <br />
                                    <strong>To:</strong> {tx.to}
                                    <br />
                                    <strong>Amount:</strong> {tx.amount} BSV
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

/** ========== STYLING & ANIMATIONS ========== */

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        position: 'relative',
        height: '100vh',
        width: '100vw',
        overflow: 'auto',
        margin: 0,
        padding: 0,
        fontFamily: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`,
        color: '#2c3e50',
        textAlign: 'center',
        backgroundColor: '#f5f7fa',
    },

    background: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        backgroundColor: '#f5f7fa',
    },

    content: {
        position: 'relative',
        marginTop: 50,
        marginBottom: 50,
        padding: 20,
        width: '90%',
        maxWidth: 700,
        marginLeft: 'auto',
        marginRight: 'auto',
        backgroundColor: '#ffffff',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        border: '1px solid #e1e8ed',
    },

    title: {
        fontSize: '2.5rem',
        margin: '2em 0 0',
        fontWeight: 600,
        color: '#2c5282',
    },
    subtitle: {
        marginTop: 10,
        marginBottom: 20,
        fontSize: '1.2rem',
        lineHeight: 1.4,
        color: '#4a5568',
    },

    musicToggleArea: {
        marginBottom: 20,
    },
    musicButton: {
        backgroundColor: '#3182ce',
        border: 'none',
        padding: '10px 25px',
        fontSize: '1rem',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        color: '#fff',
        fontWeight: 600,
    },

    section: {
        marginTop: 30,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: '1.5rem',
        marginBottom: 10,
        color: '#2c5282',
        fontWeight: 500,
    },

    label: {
        fontWeight: 'bold',
        fontSize: '1rem',
        marginBottom: 5,
    },
    addressBox: {
        backgroundColor: '#edf2f7',
        padding: '10px',
        borderRadius: 4,
        marginBottom: 10,
        overflowWrap: 'break-word',
        fontSize: '0.9rem',
        letterSpacing: '0.5px',
        color: '#4a5568',
        border: '1px solid #e2e8f0',
    },
    buttonsRow: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 10,
    },
    actionButton: {
        backgroundColor: '#3182ce',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: 4,
        border: 'none',
        fontSize: '1rem',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'background-color 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    shoutButton: {
        backgroundColor: '#4299e1',
    },
    balanceText: {
        marginTop: 15,
        fontSize: '1.1rem',
        color: '#4a5568',
    },

    input: {
        display: 'block',
        width: '80%',
        maxWidth: 400,
        margin: '10px auto',
        padding: '10px',
        borderRadius: 4,
        border: '1px solid #cbd5e0',
        outline: 'none',
        fontSize: '1rem',
        textAlign: 'center',
        backgroundColor: '#fff',
        color: '#2d3748',
    },
    emptyState: {
        marginTop: 15,
        fontSize: '0.95rem',
        color: '#718096',
    },
    txList: {
        listStyle: 'none',
        margin: 0,
        padding: 0,
        textAlign: 'left',
    },
    txListItem: {
        backgroundColor: '#f8fafc',
        marginBottom: 10,
        padding: 10,
        borderRadius: 4,
        fontSize: '0.9rem',
        overflowWrap: 'break-word',
        color: '#4a5568',
        border: '1px solid #e2e8f0',
    },
    qrCodeContainer: {
        display: 'flex',
        justifyContent: 'center',
        margin: '15px 0',
    },
    link: {
        color: '#3182ce',
        textDecoration: 'none',
    },
    disabledButton: {
        backgroundColor: '#94a3b8',
        cursor: 'not-allowed',
        opacity: 0.7,
        boxShadow: 'none',
    },
};

/**
 * We define our keyframe animations here:
 *  - A slow horizontal pan for the background
 *  - A pulse for the SHOUT button
 */
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerHTML = `
body {
  margin: 0;
  background-color: #f5f7fa;
}

/* Hover effect on buttons */
button:hover {
  background-color: #2b6cb0;
}

/* Active (clicked) effect on buttons */
button:active {
  background-color: #2c5282;
}

input:focus {
  border-color: #4299e1;
  box-shadow: 0 0 0 1px #4299e1;
}
`;
document.head.appendChild(styleSheet);

export default Mountaintops;
