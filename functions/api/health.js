// GET /api/health
import { successResponse } from '../_shared/utils.js';

export async function onRequestGet(context) {
  return successResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'nexus-email-sender',
  });
}
