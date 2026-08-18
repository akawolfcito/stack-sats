/**
 * Where a tapped activity row goes.
 *
 * The Activity list mixes both chains, but the transaction detail screen
 * only speaks to the Stacks API, so a Bitcoin txid sent there renders
 * "Transaction not found" and nothing else, however real the transaction
 * is. UserHomeView knew that and guarded inline; AssetDetailView, which
 * renders the same rows on /asset/btc, pushed the Stacks route for
 * everything, so every Bitcoin row on that screen was a dead end.
 *
 * One list deserves one answer, so the decision lives here and both
 * screens ask it rather than each carrying its own copy.
 */

import { getBtcTxExplorerUrl } from '../bitcoin/balance';
import type { NetworkName } from '../network';

export type ActivityTarget =
  | { kind: 'stacks'; path: string }
  | { kind: 'bitcoin'; url: string };

/**
 * @param txId the row that was tapped
 * @param btcTxIds every txid the Bitcoin history holds right now
 * @param network which chain's explorer to point at
 */
export function activityTarget(
  txId: string,
  btcTxIds: readonly string[],
  network?: NetworkName
): ActivityTarget {
  // Compared without case: a txid is hex, and the two chains' APIs do not
  // agree on which case they hand it back in.
  const wanted = txId.toLowerCase();
  const isBitcoin = btcTxIds.some((id) => id.toLowerCase() === wanted);

  return isBitcoin
    ? { kind: 'bitcoin', url: getBtcTxExplorerUrl(txId, network) }
    : { kind: 'stacks', path: `/transaction/${txId}` };
}
