import { z } from "zod";

/** Stacks address: SP/ST prefix + 33-41 c32 characters */
const StxAddressSchema = z.string().regex(
  /^(SP|ST)[0-9A-HJ-NP-Z]{33,41}$/,
  "Invalid Stacks address format"
);

/** Contract identifier: address.name */
const ContractIdSchema = z.string().regex(
  /^(SP|ST)[0-9A-HJ-NP-Z]{33,41}\.[a-zA-Z][a-zA-Z0-9_-]{0,127}$/,
  "Contract must be in format address.name"
);

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

/** Optional network params (baseUrl validated separately) */
const NetworkParamsSchema = z.object({
  chainId: z.number().optional(),
  client: z.object({
    baseUrl: z.string().url().optional(),
  }).optional(),
}).optional();

export const TransferStxParamsSchema = z.object({
  recipient: StxAddressSchema,
  amount: PositiveAmountSchema,
  memo: z.string().max(34).optional(),
  network: NetworkParamsSchema,
});

export const CallContractParamsSchema = z.object({
  contract: ContractIdSchema,
  functionName: z.string().min(1).max(128),
  functionArgs: z.array(z.unknown()).default([]),
  network: NetworkParamsSchema,
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
});

export type TransferStxParams = z.infer<typeof TransferStxParamsSchema>;
export type CallContractParams = z.infer<typeof CallContractParamsSchema>;
export type SignMessageParams = z.infer<typeof SignMessageParamsSchema>;
export type SignStructuredDataParams = z.infer<typeof SignStructuredDataParamsSchema>;
export type DeployContractParams = z.infer<typeof DeployContractParamsSchema>;
