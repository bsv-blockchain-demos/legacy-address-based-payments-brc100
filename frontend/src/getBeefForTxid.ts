/* eslint-disable @typescript-eslint/no-unused-vars */
import { Beef, ListActionsResult, ListOutputsResult } from '@bsv/sdk';
import { sdk, Services, StorageProvider, TableCertificate, TableCertificateField, TableCertificateX, TableCommission, TableMonitorEvent, TableOutput, TableOutputBasket, TableOutputTag, TableOutputTagMap, TableProvenTx, TableProvenTxReq, TableSettings, TableSyncState, TableTransaction, TableTxLabel, TableTxLabelMap, TableUser } from '@bsv/wallet-toolbox-client'
import { StorageGetBeefOptions } from '@bsv/wallet-toolbox-client/out/src/sdk/WalletStorage.interfaces';

class ProtoStorage extends StorageProvider {
    gbo: StorageGetBeefOptions
    whatsOnChainApiKey?: string

    constructor(chain: sdk.Chain) {
        const o = StorageProvider.createStorageBaseOptions(chain)
        super(o)
        const so = Services.createDefaultOptions(chain)
        so.whatsOnChainApiKey = 'mainnet_f04a761108dc219136b903597c91c778'
        const s = new Services(so)
        this.setServices(s)
        this.gbo = {
            ignoreNewProven: true,
            ignoreServices: false,
            ignoreStorage: true
        }
    }

    async getBeefForTxid(txid: string): Promise<Beef> {
        const beef = await this.getBeefForTransaction(txid, this.gbo)
        return beef
    }
    override reviewStatus(_args: { agedLimit: Date; trx?: sdk.TrxToken }): Promise<{ log: string }> {
        throw new Error('Method not implemented.')
    }
    override purgeData(_params: sdk.PurgeParams, _trx?: sdk.TrxToken): Promise<sdk.PurgeResults> {
        throw new Error('Method not implemented.')
    }
    override allocateChangeInput(_userId: number, _basketId: number, _targetSatoshis: number, _exactSatoshis: number | undefined, _excludeSending: boolean, _transactionId: number): Promise<TableOutput | undefined> {
        throw new Error('Method not implemented.')
    }
    override getProvenOrRawTx(_txid: string, _trx?: sdk.TrxToken): Promise<sdk.ProvenOrRawTx> {
        throw new Error('Method not implemented.')
    }
    override getRawTxOfKnownValidTransaction(_txid?: string, _offset?: number, _length?: number, _trx?: sdk.TrxToken): Promise<number[] | undefined> {
        throw new Error('Method not implemented.')
    }
    override getLabelsForTransactionId(_transactionId?: number, _trx?: sdk.TrxToken): Promise<TableTxLabel[]> {
        throw new Error('Method not implemented.')
    }
    override getTagsForOutputId(_outputId: number, _trx?: sdk.TrxToken): Promise<TableOutputTag[]> {
        throw new Error('Method not implemented.')
    }
    override listActions(_auth: sdk.AuthId, _args: sdk.ValidListActionsArgs): Promise<ListActionsResult> {
        throw new Error('Method not implemented.')
    }
    override listOutputs(_auth: sdk.AuthId, _args: sdk.ValidListOutputsArgs): Promise<ListOutputsResult> {
        throw new Error('Method not implemented.')
    }
    override countChangeInputs(_userId: number, _basketId: number, _excludeSending: boolean): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override findCertificatesAuth(_auth: sdk.AuthId, _args: sdk.FindCertificatesArgs): Promise<TableCertificateX[]> {
        throw new Error('Method not implemented.')
    }
    override findOutputBasketsAuth(_auth: sdk.AuthId, _args: sdk.FindOutputBasketsArgs): Promise<TableOutputBasket[]> {
        throw new Error('Method not implemented.')
    }
    override findOutputsAuth(_auth: sdk.AuthId, _args: sdk.FindOutputsArgs): Promise<TableOutput[]> {
        throw new Error('Method not implemented.')
    }
    override insertCertificateAuth(_auth: sdk.AuthId, _certificate: TableCertificateX): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override dropAllData(): Promise<void> {
        throw new Error('Method not implemented.')
    }
    override migrate(_storageName: string, _storageIdentityKey: string): Promise<string> {
        throw new Error('Method not implemented.')
    }
    override findOutputTagMaps(_args: sdk.FindOutputTagMapsArgs): Promise<TableOutputTagMap[]> {
        throw new Error('Method not implemented.')
    }
    override findProvenTxReqs(_args: sdk.FindProvenTxReqsArgs): Promise<TableProvenTxReq[]> {
        throw new Error('Method not implemented.')
    }
    override findProvenTxs(_args: sdk.FindProvenTxsArgs): Promise<TableProvenTx[]> {
        throw new Error('Method not implemented.')
    }
    override findTxLabelMaps(_args: sdk.FindTxLabelMapsArgs): Promise<TableTxLabelMap[]> {
        throw new Error('Method not implemented.')
    }
    override countOutputTagMaps(_args: sdk.FindOutputTagMapsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countProvenTxReqs(_args: sdk.FindProvenTxReqsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countProvenTxs(_args: sdk.FindProvenTxsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countTxLabelMaps(_args: sdk.FindTxLabelMapsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertCertificate(_certificate: TableCertificate, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertCertificateField(_certificateField: TableCertificateField, _trx?: sdk.TrxToken): Promise<void> {
        throw new Error('Method not implemented.')
    }
    override insertCommission(_commission: TableCommission, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertMonitorEvent(_event: TableMonitorEvent, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertOutput(_output: TableOutput, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertOutputBasket(_basket: TableOutputBasket, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertOutputTag(_tag: TableOutputTag, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertOutputTagMap(_tagMap: TableOutputTagMap, _trx?: sdk.TrxToken): Promise<void> {
        throw new Error('Method not implemented.')
    }
    override insertProvenTx(_tx: TableProvenTx, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertProvenTxReq(_tx: TableProvenTxReq, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertSyncState(_syncState: TableSyncState, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertTransaction(_tx: TableTransaction, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertTxLabel(_label: TableTxLabel, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override insertTxLabelMap(_labelMap: TableTxLabelMap, _trx?: sdk.TrxToken): Promise<void> {
        throw new Error('Method not implemented.')
    }
    override insertUser(_user: TableUser, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateCertificate(_id: number, _update: Partial<TableCertificate>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateCertificateField(_certificateId: number, _fieldName: string, _update: Partial<TableCertificateField>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateCommission(_id: number, _update: Partial<TableCommission>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateMonitorEvent(_id: number, _update: Partial<TableMonitorEvent>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateOutput(_id: number, _update: Partial<TableOutput>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateOutputBasket(_id: number, _update: Partial<TableOutputBasket>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateOutputTag(_id: number, _update: Partial<TableOutputTag>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateOutputTagMap(_outputId: number, _tagId: number, _update: Partial<TableOutputTagMap>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateProvenTx(_id: number, _update: Partial<TableProvenTx>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateProvenTxReq(_id: number | number[], _update: Partial<TableProvenTxReq>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateSyncState(_id: number, _update: Partial<TableSyncState>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateTransaction(_id: number | number[], _update: Partial<TableTransaction>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateTxLabel(_id: number, _update: Partial<TableTxLabel>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateTxLabelMap(_transactionId: number, _txLabelId: number, _update: Partial<TableTxLabelMap>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override updateUser(_id: number, _update: Partial<TableUser>, _trx?: sdk.TrxToken): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override destroy(): Promise<void> {
        throw new Error('Method not implemented.')
    }
    override transaction<T>(_scope: (trx: sdk.TrxToken) => Promise<T>, _trx?: sdk.TrxToken): Promise<T> {
        throw new Error('Method not implemented.')
    }
    override readSettings(_trx?: sdk.TrxToken): Promise<TableSettings> {
        throw new Error('Method not implemented.')
    }
    override findCertificateFields(_args: sdk.FindCertificateFieldsArgs): Promise<TableCertificateField[]> {
        throw new Error('Method not implemented.')
    }
    override findCertificates(_args: sdk.FindCertificatesArgs): Promise<TableCertificateX[]> {
        throw new Error('Method not implemented.')
    }
    override findCommissions(_args: sdk.FindCommissionsArgs): Promise<TableCommission[]> {
        throw new Error('Method not implemented.')
    }
    override findMonitorEvents(_args: sdk.FindMonitorEventsArgs): Promise<TableMonitorEvent[]> {
        throw new Error('Method not implemented.')
    }
    override findOutputBaskets(_args: sdk.FindOutputBasketsArgs): Promise<TableOutputBasket[]> {
        throw new Error('Method not implemented.')
    }
    override findOutputs(_args: sdk.FindOutputsArgs): Promise<TableOutput[]> {
        throw new Error('Method not implemented.')
    }
    override findOutputTags(_args: sdk.FindOutputTagsArgs): Promise<TableOutputTag[]> {
        throw new Error('Method not implemented.')
    }
    override findSyncStates(_args: sdk.FindSyncStatesArgs): Promise<TableSyncState[]> {
        throw new Error('Method not implemented.')
    }
    override findTransactions(_args: sdk.FindTransactionsArgs): Promise<TableTransaction[]> {
        throw new Error('Method not implemented.')
    }
    override findTxLabels(_args: sdk.FindTxLabelsArgs): Promise<TableTxLabel[]> {
        throw new Error('Method not implemented.')
    }
    override findUsers(_args: sdk.FindUsersArgs): Promise<TableUser[]> {
        throw new Error('Method not implemented.')
    }
    override countCertificateFields(_args: sdk.FindCertificateFieldsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countCertificates(_args: sdk.FindCertificatesArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countCommissions(_args: sdk.FindCommissionsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countMonitorEvents(_args: sdk.FindMonitorEventsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countOutputBaskets(_args: sdk.FindOutputBasketsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countOutputs(_args: sdk.FindOutputsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countOutputTags(_args: sdk.FindOutputTagsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countSyncStates(_args: sdk.FindSyncStatesArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countTransactions(_args: sdk.FindTransactionsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countTxLabels(_args: sdk.FindTxLabelsArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override countUsers(_args: sdk.FindUsersArgs): Promise<number> {
        throw new Error('Method not implemented.')
    }
    override getProvenTxsForUser(_args: sdk.FindForUserSincePagedArgs): Promise<TableProvenTx[]> {
        throw new Error('Method not implemented.')
    }
    override getProvenTxReqsForUser(_args: sdk.FindForUserSincePagedArgs): Promise<TableProvenTxReq[]> {
        throw new Error('Method not implemented.')
    }
    override getTxLabelMapsForUser(_args: sdk.FindForUserSincePagedArgs): Promise<TableTxLabelMap[]> {
        throw new Error('Method not implemented.')
    }
    override getOutputTagMapsForUser(_args: sdk.FindForUserSincePagedArgs): Promise<TableOutputTagMap[]> {
        throw new Error('Method not implemented.')
    }
}

export default async function getBeefForTxid(txid: string, chain: 'main' | 'test'): Promise<Beef> {
    const ps = new ProtoStorage(chain)
    return await ps.getBeefForTxid(txid)
}
