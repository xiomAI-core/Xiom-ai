import { createHash } from 'node:crypto';
import { createReceipt, WorldModelDomain } from '@xiom/world-model';
import type { RegisteredTool } from '../types.js';
import { asString, jsonResult, type ToolContext } from './helpers.js';

const GENESIS = '0'.repeat(64);

export function createWriteReceiptTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_write_receipt',
    description:
      'Write a hash-chained cryptographic receipt and corresponding audit entry to the world model.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string' },
        context: { type: 'string' },
        policy: { type: 'string' },
        action: { type: 'string' },
        result: { type: 'string' },
      },
      required: ['intent', 'context', 'policy', 'action', 'result'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const intent = asString(args['intent']);
      const context = asString(args['context']);
      const policy = asString(args['policy']);
      const action = asString(args['action']);
      const result = asString(args['result']);

      const receipt = await createReceipt(ctx.conn, ctx.humanId, {
        intent,
        context,
        policy,
        action,
        result,
        isApproved: true,
        rollbackAvailable: false,
        domain: WorldModelDomain.TRACK,
        confidence: 1,
      });

      // Append AuditEntry to the hash chain
      const prevAudit = await ctx.conn.queryOne<{ hash: string }>(
        `MATCH (a:AuditEntry)
         WHERE coalesce(a.isDeleted, false) = false
         RETURN a.hash AS hash
         ORDER BY a.createdAt DESC
         LIMIT 1`
      );
      const prevHash = prevAudit?.hash ?? GENESIS;
      const now = new Date().toISOString();
      const auditId = crypto.randomUUID();
      const hash = createHash('sha256')
        .update(`${now}create${receipt.id}${prevHash}`)
        .digest('hex');

      await ctx.conn.query(
        `CREATE (a:AuditEntry {
           id: $id,
           nodeType: 'AuditEntry',
           operation: 'create',
           actorType: 'agent',
           actorId: $actorId,
           targetNodeId: $targetNodeId,
           targetNodeType: 'Receipt',
           changeDescription: $changeDescription,
           prevHash: $prevHash,
           hash: $hash,
           isVerified: true,
           domain: $domain,
           confidence: 1.0,
           version: 1,
           isDeleted: false,
           createdAt: $now,
           updatedAt: $now
         })`,
        {
          id: auditId,
          actorId: ctx.actorId,
          targetNodeId: receipt.id,
          changeDescription: `Receipt ${receipt.receiptNumber}: ${intent}`,
          prevHash,
          hash,
          domain: WorldModelDomain.TRACK,
          now,
        }
      );

      return jsonResult({
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        hash: receipt.hash,
        auditEntryId: auditId,
        auditHash: hash,
      });
    },
  };
}
