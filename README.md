# Legacy Address Payments with BRC-100

A React application demonstrating how a BRC-100 wallet can work with legacy BSV addresses. It derives receiving addresses, discovers unspent outputs, imports funds into the wallet and sends payments to legacy addresses.

The interface also includes a batch recovery workflow for the supported address derivation schemes. It is a wallet integration demonstration and performs real wallet operations.

## Features

- Derive the application's deterministic Mountaintops receiving address.
- Inspect address balances and unspent outputs through WhatsOnChain.
- Import legacy outputs using transaction data in BEEF format and wallet signing operations.
- Send BSV to a legacy address and inspect payment history.
- Discover and import batches from Mountaintops and date-based addresses, with browser-persisted progress and retry controls.

The batch workflow uses IndexedDB to track discovery, BEEF retrieval and import status. Date-based outputs use wallet internalisation; Mountaintops outputs are swept through signed transactions. These operations can move funds and incur fees.

## Run locally

Use Node.js 22 and npm, plus a compatible BRC-100 wallet accessible to the browser.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite, normally `http://localhost:5173`, and connect the intended wallet. The application asks the wallet which network it uses and selects the corresponding WhatsOnChain API.

No application environment file is required by the current frontend. External API configuration, including a source-configured API key in the BEEF helper, is embedded in the source. Review that configuration before publishing your own build.

## Using the demonstration

1. Confirm the connected wallet, network and derived address.
2. Use small amounts in a dedicated demonstration wallet when exercising payment or import flows.
3. Inspect the discovered outputs before approving wallet actions.
4. For batch recovery, select the supported address mode and date range, then follow the discovery and import progress.

An address alone does not provide spending authority. The connected wallet must derive the keys used by the supported address scheme. This is not a general importer for arbitrary private keys or every legacy wallet format.

Batch checkpoints live in the current browser profile. Clearing site data removes those checkpoints; consult wallet and transaction history before repeating an interrupted operation.

## Build and hosting

```sh
npm run build
npm run preview -- --host 127.0.0.1
```

Vite produces static assets in `dist/`. The supplied [Dockerfile](Dockerfile) builds the frontend and serves it through the Express server in [server.js](server.js), using port 8080 and a `/health` endpoint.

`npm run lint` is available. No automated test script is defined.

## Source guide

- [src/App.tsx](src/App.tsx): wallet connection, addresses, imports and payments.
- [src/batch/](src/batch/): batch discovery, persistence and import pipelines.
- [src/](src/): transaction and wallet helpers.

## Licence

**Open BSV Licence v6.** See [LICENSE.txt](LICENSE.txt) for the full terms. The licence applies to this project's original code and documentation and restricts use to the BSV blockchain defined in the licence. Third-party code, assets and referenced standards retain their respective terms.
