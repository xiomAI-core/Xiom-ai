/**
 * v2 authenticated routes — world-model, knowledge-graph, memory, guardrail
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth.js';
import { worldModelV2Route } from './worldmodel.js';
import { guardrailRoute } from './guardrail.js';
import { knowledgeGraphRoute } from './knowledge-graph.js';
import { memoryRoute } from './memory.js';
import { loopsRoute } from './loops.js';

export const v2Routes = new Hono();

// Require authentication on all v2 routes
v2Routes.use('*', authMiddleware);

v2Routes.route('/world-model', worldModelV2Route);
v2Routes.route('/guardrail', guardrailRoute);
v2Routes.route('/knowledge-graph', knowledgeGraphRoute);
v2Routes.route('/memory', memoryRoute);
v2Routes.route('/loops', loopsRoute);
