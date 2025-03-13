import { useState, useRef } from 'react';
import WalletClient from '@bsv/sdk/wallet/WalletClient'
import PublicKey from '@bsv/sdk/primitives/PublicKey'
import P2PKH from '@bsv/sdk/script/templates/P2PKH'
import { CreateActionInput, SignActionArgs } from '@bsv/sdk/wallet/Wallet.interfaces';
import Importer from './Importer'
import Transaction from '@bsv/sdk/transaction/Transaction';

const client = new WalletClient('auto')

const getRealWalletNetwork = async (): Promise<'mainnet' | 'testnet'> => {
    const { network } = await client.getNetwork({})
    return network
}

const getMountaintopsAddress = async (): Promise<string> => {
    const network = await getRealWalletNetwork()
    const { publicKey } = await client.getPublicKey({
        protocolID: [1, 'mountaintops'],
        keyID: '1',
        counterparty: 'anyone',
        forSelf: true
    })
    return PublicKey.fromString(publicKey).toAddress(network)
}

// Sample sound effect (a public domain or self-hosted file URL):
const shoutSoundUrl =
    'https://www.myinstants.com/media/sounds/wilhelm-scream_s8BoV1k.mp3';

// Fetch BSV balance for address
const fetchBSVBalance = async (address: string): Promise<number> => {
    const network = await getRealWalletNetwork()
    const balanceResponse = await fetch(
        `https://api.whatsonchain.com/v1/bsv/${network === 'mainnet' ? 'main' : 'test'}/address/${address}/balance`
    )
    const balanceJSON = await balanceResponse.json()
    return (balanceJSON.confirmed + balanceJSON.unconfirmed) / 100000000
};

// Shout BSV to an address
const sendBSV = async (to: string, amount: number): Promise<string | undefined> => {
    const network = await getRealWalletNetwork()
    if (network === 'mainnet' && !to.startsWith('1')) {
        alert('You are on mainnet but the recipient address does not start with 1!')
        return
    }
    const lockingScript = new P2PKH().lock(to).toHex()
    const { txid } = await client.createAction({
        description: 'Shout BSV at an address',
        outputs: [{
            lockingScript,
            satoshis: Math.round(amount * 100000000),
            outputDescription: 'BSV for recipient address'
        }]
    })
    return txid;
};

const Mountaintops: React.FC = () => {
    const [mountaintopsAddress, setMountaintopsAddress] = useState<string | null>(null);
    const [balance, setBalance] = useState<number>(-1);
    const [recipientAddress, setRecipientAddress] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [transactions, setTransactions] = useState<Array<{
        txid: string;
        to: string;
        amount: string;
    }>>([]);

    // Ref for the "shout" audio
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleViewAddress = async () => {
        // Show them that they have NO privacy with this one address
        setMountaintopsAddress(await getMountaintopsAddress());
    };

    const handleGetBalance = async () => {
        if (mountaintopsAddress) {
            const fetchedBalance = await fetchBSVBalance(mountaintopsAddress);
            setBalance(fetchedBalance);
        } else {
            alert('Get your address first!')
        }
    };

    const handleImportFunds = async () => {
        if (!mountaintopsAddress || balance < 0) {
            alert('Get your address and balance first!')
            return
        }
        if (balance === 0) {
            alert('No money to import!')
            return
        }
        let reference: string | undefined = undefined
        try {
            const network = await getRealWalletNetwork()
            const wocNet = network === 'testnet' ? 'test' : 'main'
            const UTXOResponse = await fetch(
                `https://api.whatsonchain.com/v1/bsv/${wocNet}/address/${mountaintopsAddress}/unspent`
            )
            const UTXOJson = await UTXOResponse.json()
            const inputs: CreateActionInput[] = UTXOJson.map((x: any): CreateActionInput => ({
                outpoint: `${x.tx_hash}.${x.tx_pos}`,
                inputDescription: 'Redeem from the Mountaintops',
                unlockingScriptLength: 108
            }))
            const inputBEEF = [1] // TODO: Get a complete input BEEF comprising all identified UTXOs
            const { signableTransaction } = await client.createAction({
                inputBEEF,
                inputs,
                description: 'Import from the Mountaintops'
            })
            reference = signableTransaction!.reference
            const tx = Transaction.fromAtomicBEEF(signableTransaction!.tx)
            const importer = new Importer()
            const unlocker = importer.unlock(client)
            const signActionArgs: SignActionArgs = {
                reference,
                spends: {}
            }
            for (let i = 0; i < inputs.length; i++) {
                const script = await unlocker.sign(tx, i)
                signActionArgs.spends[i] = {
                    unlockingScript: script.toHex()
                }
            }
            await client.signAction(signActionArgs)
            setBalance(0);
        } catch (e) {
            if (reference) {
                await client.abortAction({ reference })
            }
            const message = `Import failed: ${(e as any).message || 'unknown error'}`
            alert(message)
        }
    };

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
            // Play a "shout" sound effect if available
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {
                    // Browser might block auto-play if there's no user interaction
                });
            }
            alert(
                `Successfully SHOUTED ${amt} BSV from your real wallet to ${recipientAddress} with absolutely no privacy! TXID: ${txid}`
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
            {/* A background image of a mountainscape */}
            <div style={styles.backgroundOverlay}></div>

            <audio ref={audioRef} src={shoutSoundUrl} preload="auto" />

            <div style={styles.content}>
                <h1 style={styles.title}>Mountaintops</h1>
                <h2 style={styles.tagline}>
                    Shout all your transactions from the mountaintops, with <br />
                    <span style={{ color: 'red', fontWeight: 'bold' }}>ABSOLUTELY NO PRIVACY!</span>
                </h2>

                <div style={styles.section}>
                    {mountaintopsAddress ? (
                        <>
                            <p style={styles.addressLabel}>
                                Your Mountaintops Address (totally exposed):
                            </p>
                            <div style={styles.addressBox}>{mountaintopsAddress}</div>
                            <div style={styles.buttonsRow}>
                                <button style={styles.button} onClick={handleGetBalance}>
                                    Get Balance
                                </button>
                                <button style={styles.button} onClick={handleImportFunds}>
                                    Import Money
                                </button>
                            </div>
                            <p style={styles.balanceText}>
                                Current BSV at this super-public address: {balance === -1 ? 'Not checked yet!' : `${balance} BSV`}
                            </p>
                        </>
                    ) : (
                        <button style={styles.button} onClick={handleViewAddress}>
                            Show My BSV Address
                        </button>
                    )}
                </div>

                <div style={styles.section}>
                    <h3 style={styles.shoutLabel}>
                        Shout BSV Across To Someone (recipient's address + amount)
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
                    <button style={{ ...styles.button, ...styles.shoutButton }} onClick={handleShoutBSV}>
                        SHOUT BSV
                    </button>
                </div>

                <div style={styles.section}>
                    <h3 style={{ color: '#fffffe', textShadow: '1px 1px 2px #000' }}>Shouted Transactions</h3>
                    {transactions.length === 0 ? (
                        <p style={styles.noTransactions}>
                            No transactions shouted yet... but wait for it, the entire world will see them!
                        </p>
                    ) : (
                        <ul style={styles.transactionsList}>
                            {transactions.map((tx, index) => (
                                <li key={index} style={styles.transactionItem}>
                                    <strong>TXID:</strong> {tx.txid} <br />
                                    <strong>To:</strong> {tx.to} <br />
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

/** Inline styling (for quick demonstration) */
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        fontFamily: 'sans-serif',
        position: 'relative',
        height: '100vh',
        width: '100vw',
        overflow: 'auto',
        color: '#fffffe',
        textAlign: 'center',
    },
    backgroundOverlay: {
        backgroundImage:
            'url(https://images.unsplash.com/photo-1597210533843-2c69a3ac12f3?ixlib=rb-4.0.3&w=1600)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(2px) brightness(0.8)',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
    },
    content: {
        marginTop: 50,
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 10,
        width: '90%',
        maxWidth: 700,
        marginLeft: 'auto',
        marginRight: 'auto',
    },
    title: {
        fontSize: '3rem',
        margin: 0,
        fontWeight: 'bold',
        textShadow: '2px 2px 5px #000',
    },
    tagline: {
        fontSize: '1.2rem',
        marginBottom: 30,
    },
    section: {
        marginBottom: 40,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#ff004c',
        color: '#ffffff',
        padding: '10px 20px',
        borderRadius: 8,
        border: 'none',
        fontSize: '1rem',
        cursor: 'pointer',
        margin: '0 10px',
        transition: 'all 0.2s ease-in-out',
    },
    shoutButton: {
        animation: 'pulse 2s infinite',
        fontWeight: 'bold',
    },
    addressLabel: {
        fontSize: '1rem',
        marginBottom: 5,
        fontWeight: 'bold',
    },
    addressBox: {
        backgroundColor: '#333333',
        padding: '10px',
        borderRadius: 6,
        marginBottom: 10,
        overflowWrap: 'break-word',
    },
    buttonsRow: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 20,
    },
    balanceText: {
        marginTop: 10,
        fontSize: '1.1rem',
    },
    shoutLabel: {
        marginBottom: 10,
        color: '#fffffe',
        textShadow: '1px 1px 2px #000',
    },
    input: {
        width: '80%',
        maxWidth: 400,
        padding: '10px',
        margin: '5px 0',
        borderRadius: 6,
        border: '2px solid #ff004c',
        outline: 'none',
        fontSize: '1rem',
        textAlign: 'center',
    },
    noTransactions: {
        marginTop: 10,
        fontStyle: 'italic',
    },
    transactionsList: {
        listStyle: 'none',
        paddingLeft: 0,
        textAlign: 'left',
        marginTop: 10,
    },
    transactionItem: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 10,
        padding: 10,
        borderRadius: 6,
    },
};

// Keyframe animation for the Shout button
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerHTML = `
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 10px rgba(255,0,76,0.5); }
  50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(255,0,76,0.8); }
  100% { transform: scale(1); box-shadow: 0 0 10px rgba(255,0,76,0.5); }
}
@keyframes buttonHover {
  from { transform: scale(1); }
  to { transform: scale(1.05); }
}
@keyframes buttonActive {
  from { transform: scale(1.05); }
  to { transform: scale(0.95); }
}
`;
document.head.appendChild(styleSheet);

export default Mountaintops;
