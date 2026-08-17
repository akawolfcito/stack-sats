import { z } from "zod";
import { isContractId, isStacksAddress } from "./address";

/**
 * Stacks address, decided by c32check rather than by a guessed length.
 *
 * The old rule was SP/ST plus 33 to 41 characters. c32 strips leading
 * zeros, so boot addresses are far shorter: pox-4 lives at
 * ST000000000000000000002AMW42H, 29 characters. Every system contract
 * was rejected as invalid before a handler saw the request.
 */
const StxAddressSchema = z
  .string()
  .refine(isStacksAddress, "Invalid Stacks address format");

/** Contract identifier: address.name */
const ContractIdSchema = z
  .string()
  .refine(isContractId, "Contract must be in format address.name");

/** Positive non-zero amount as string (for BigInt conversion) */
const PositiveAmountSchema = z.string().refine(
  (val) => {
    try {
      const n = BigInt(val);
      return n > 0n;
    } catch {
      return false;
    }
  },
  "Amount must be a positive integer string"
);

/**
 * Optional network params (baseUrl validated separately).
 *
 * A dApp sends a plain string: @stacks/connect types this as
 * NetworkString and Hiro's sandbox puts "testnet" on the wire. Only the
 * object form was accepted, so every dApp call that named its network
 * failed validation with -32602 before reaching a handler. Both forms are
 * valid now, and resolveRequestedNetwork decides what the string means.
 */
const NetworkParamsSchema = z
  .union([
    z.string().min(1).max(32),
    z.object({
      chainId: z.number().optional(),
      client: z
        .object({
          baseUrl: z.string().url().optional(),
        })
        .optional(),
    }),
  ])
  .optional();

export const TransferStxParamsSchema = z.object({
  recipient: StxAddressSchema,
  amount: PositiveAmountSchema,
  memo: z.string().max(34).optional(),
  network: NetworkParamsSchema,
});

/**
 * Transaction knobs every dApp method may set, from CommonTxParams in
 * @stacks/connect. These were absent from the schemas, so Zod stripped
 * them before the handlers ever saw them.
 */
const CommonTxParamsSchema = {
  postConditions: z.array(z.unknown()).optional(),
  postConditionMode: z.union([z.string(), z.number()]).optional(),
  fee: z.union([z.string(), z.number()]).optional(),
  nonce: z.union([z.string(), z.number()]).optional(),
  sponsored: z.boolean().optional(),
};

export const CallContractParamsSchema = z.object({
  contract: ContractIdSchema,
  functionName: z.string().min(1).max(128),
  functionArgs: z.array(z.unknown()).default([]),
  network: NetworkParamsSchema,
  ...CommonTxParamsSchema,
});

export const SignMessageParamsSchema = z.object({
  message: z.string().min(1).max(1_048_576), // 1MB max
});

export const GetAddressesParamsSchema = z.object({}).passthrough();

/**
 * SIP-018 structured data signing.
 * `message` and `domain` arrive as serialized ClarityValues from @stacks/connect.
 * Runtime validation is handled by @stacks/transactions' signStructuredData.
 */
export const SignStructuredDataParamsSchema = z.object({
  message: z.unknown(), // ClarityValue - validated at runtime by @stacks/transactions
  domain: z.unknown(),  // ClarityValue tuple for domain (name, version, chain-id)
});

/**
 * Contract deployment params.
 * `name` is the on-chain contract name (max 128 chars per Stacks spec).
 * `clarityCode` is the Clarity source to deploy.
 * `clarityVersion` is optional (defaults to latest in @stacks/transactions).
 */
export const DeployContractParamsSchema = z.object({
  name: z.string().min(1).max(128),
  clarityCode: z.string().min(1),
  clarityVersion: z.number().optional(),
  network: NetworkParamsSchema,
  ...CommonTxParamsSchema,
});

export type TransferStxParams = z.infer<typeof TransferStxParamsSchema>;
export type CallContractParams = z.infer<typeof CallContractParamsSchema>;
export type SignMessageParams = z.infer<typeof SignMessageParamsSchema>;
export type SignStructuredDataParams = z.infer<typeof SignStructuredDataParamsSchema>;
export type DeployContractParams = z.infer<typeof DeployContractParamsSchema>;
