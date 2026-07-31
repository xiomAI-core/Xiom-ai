import type { RegisteredTool } from '../types.js';
import { asNumber, asString, jsonResult, type ToolContext } from './helpers.js';

interface ScoredNode {
  id: string;
  nodeType: string;
  label: string;
  score: number;
  properties: Record<string, unknown>;
}

export function createQueryWorldModelTool(ctx: ToolContext): RegisteredTool {
  return {
    name: 'axiom_query_world_model',
    description:
      'Fulltext search over facts and goals in the XIOM world model (fact_content + goal_search indexes).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Fulltext search query' },
        domain: { type: 'string', description: 'Optional domain filter' },
        limit: { type: 'integer', description: 'Max results', default: 10 },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const query = asString(args['query']);
      const limit = asNumber(args['limit'], 10);
      const domain = args['domain'] !== undefined ? asString(args['domain']) : undefined;

      if (!query) {
        return jsonResult({ nodes: [], totalCount: 0 }, 'Empty query', true);
      }

      // Run two fulltext queries and merge/sort by score (UNION of CALL is awkward in Neo4j)
      const [factRows, goalRows] = await Promise.all([
        ctx.conn
          .queryMany<{
            id: string;
            content: string;
            domain: string;
            score: number;
            props: Record<string, unknown>;
          }>(
            `CALL db.index.fulltext.queryNodes('fact_content', $query)
             YIELD node AS f, score
             WHERE coalesce(f.isStale, false) = false
               AND coalesce(f.isDeleted, false) = false
               AND ($domain IS NULL OR f.domain = $domain)
             RETURN f.id AS id, f.content AS content, f.domain AS domain, score, f { .* } AS props
             ORDER BY score DESC
             LIMIT $limit`,
            { query, limit, domain: domain ?? null }
          )
          .catch(() => []),
        ctx.conn
          .queryMany<{
            id: string;
            name: string;
            description: string;
            domain: string;
            score: number;
            props: Record<string, unknown>;
          }>(
            `CALL db.index.fulltext.queryNodes('goal_search', $query)
             YIELD node AS g, score
             WHERE coalesce(g.isDeleted, false) = false
               AND ($domain IS NULL OR g.domain = $domain)
             RETURN g.id AS id, g.name AS name, g.description AS description,
                    g.domain AS domain, score, g { .* } AS props
             ORDER BY score DESC
             LIMIT $limit`,
            { query, limit, domain: domain ?? null }
          )
          .catch(() => []),
      ]);

      const nodes: ScoredNode[] = [
        ...factRows.map((r) => ({
          id: r.id,
          nodeType: 'Fact',
          label: r.content,
          score: Number(r.score),
          properties: r.props ?? {},
        })),
        ...goalRows.map((r) => ({
          id: r.id,
          nodeType: 'Goal',
          label: r.name,
          score: Number(r.score),
          properties: r.props ?? {},
        })),
      ]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const structured = { nodes, totalCount: nodes.length, query };
      return jsonResult(structured);
    },
  };
}
