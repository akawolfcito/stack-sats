/**
 * DenSignal v0.1 — Zod schema and inferred type
 *
 * Inlined from @denlabs/engine-core so den-vault can build as a standalone repo.
 * Keep in sync with denlabs-engine-core/src/densignal/schema.ts
 */

import { z } from 'zod'

export const DenSignalSchema = z.object({
  version: z.literal('0.1'),

  id: z.string().min(8),
  ts: z.string().datetime(),

  source: z.object({
    kind: z.enum(['onchain', 'offchain']),
    system: z.string().min(2),
    adapter: z.string().min(2).optional(),
  }),

  subject: z.object({
    type: z.enum(['tx', 'address', 'contract', 'batch', 'session', 'user']),
    id: z.string().min(4),
  }),

  actor: z
    .object({
      type: z.enum(['address', 'service', 'user']).optional(),
      id: z.string().min(2).optional(),
    })
    .optional(),

  action: z.object({
    name: z.string().min(2),
    stage: z.enum(['attempt', 'success', 'failure']).optional(),
  }),

  context: z
    .object({
      chain: z
        .object({
          family: z.enum(['evm', 'solana', 'stacks', 'other']),
          chainId: z.number().int().positive().optional(),
          network: z.string().optional(),
        })
        .optional(),
      tx: z
        .object({
          hash: z.string().min(10).optional(),
          blockNumber: z.number().int().nonnegative().optional(),
        })
        .optional(),
      correlationId: z.string().optional(),
    })
    .optional(),

  measures: z
    .object({
      cost: z
        .object({
          unit: z.enum(['wei', 'gwei', 'usd', 'usdc', 'native']),
          value: z.number().nonnegative(),
        })
        .optional(),
      latencyMs: z.number().int().nonnegative().optional(),
      amount: z
        .object({
          unit: z.string().min(1),
          value: z.number(),
        })
        .optional(),
    })
    .optional(),

  tags: z.array(z.string().min(1)).max(32).optional(),

  evidence: z
    .object({
      refs: z.array(z.string().min(3)).max(32).optional(),
    })
    .optional(),
})

export type DenSignal = z.infer<typeof DenSignalSchema>
