/**
 * Turning what a dApp puts on the wire into what the SDK expects.
 *
 * `@stacks/connect` types a contract call's arguments as
 * `string[] | ClarityValue[]`, and over JSON-RPC only the strings survive:
 * a ClarityValue carrying a BigInt cannot be serialized. The wallet used
 * to cast those strings straight to ClarityValue[], which is a lie the
 * type system cannot catch and the node rejects.
 *
 * The transaction options are the other half. postConditions and
 * postConditionMode were dropped entirely, and they are not decoration:
 * they are the user's guarantee that a contract cannot move more than it
 * said it would. The SDK defaults to Deny, so a call that transfers
 * anything aborts on chain once its conditions go missing.
 */

import {
  hexToCV,
  type ClarityValue,
  type PostCondition,
  type PostConditionMode,
  type PostConditionModeName,
  type PostConditionWire,
} from '@stacks/transactions';

/** What the SDK accepts for a post condition: an object, wire form or hex. */
type AnyPostCondition = PostCondition | PostConditionWire | string;

/** The SDK's IntegerType, which is not exported by name. */
type IntegerLike = string | number | bigint;

/** The transaction knobs a dApp may set, straight from CommonTxParams. */
export interface DappTxParams {
  postConditions?: unknown;
  postConditionMode?: unknown;
  fee?: unknown;
  nonce?: unknown;
  sponsored?: unknown;
}

/** What is handed to makeContractCall / makeContractDeploy. */
export interface TxOptions {
  postConditions?: AnyPostCondition[];
  postConditionMode?: PostConditionModeName | PostConditionMode;
  fee?: IntegerLike;
  nonce?: IntegerLike;
  sponsored?: boolean;
}

/**
 * Deserialize contract-call arguments.
 *
 * @throws when a string is not a Clarity value, which is better than a
 * transaction that means something other than what was asked.
 */
export function toClarityArgs(args: unknown[] | undefined): ClarityValue[] {
  if (!Array.isArray(args)) return [];

  return args.map((arg, index) => {
    if (typeof arg !== 'string') {
      return arg as ClarityValue;
    }

    try {
      return hexToCV(arg);
    } catch (error) {
      throw new Error(
        `Function argument ${index} is not a serialized Clarity value: ${String(error)}`
      );
    }
  });
}

/**
 * Copy across only what the dApp actually set.
 *
 * Absent keys are left absent rather than sent as undefined, so the SDK
 * applies its own defaults instead of being told nothing explicitly.
 */
export function toTxOptions(params: DappTxParams): TxOptions {
  const options: TxOptions = {};

  if (Array.isArray(params.postConditions)) {
    options.postConditions = params.postConditions as AnyPostCondition[];
  }
  if (params.postConditionMode !== undefined) {
    options.postConditionMode = params.postConditionMode as
      | PostConditionModeName
      | PostConditionMode;
  }
  if (params.fee !== undefined) {
    options.fee = params.fee as IntegerLike;
  }
  if (params.nonce !== undefined) {
    options.nonce = params.nonce as IntegerLike;
  }
  if (params.sponsored !== undefined) {
    options.sponsored = Boolean(params.sponsored);
  }

  return options;
}
