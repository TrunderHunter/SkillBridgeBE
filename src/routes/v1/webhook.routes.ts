import { Router } from 'express';
import JitsiWebhookController from '../../controllers/webhook/jitsi.webhook.controller';

const router = Router();

/**
 * Webhook Routes
 * These routes are called by external services (Jitsi, payment gateways, etc.)
 * No authentication required (but signature verification is done inside controller)
 */

// Jitsi webhooks
router.post('/jitsi', JitsiWebhookController.handleWebhook);

export default router;
