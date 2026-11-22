import { QUEUES } from '../services/queue/topology.js';
import { handleEmailEvent } from './emailWorker.js';
import { handleMediaJob } from './mediaWorker.js';
import { handleAuditEvent } from './auditWorker.js';

// Consumers the worker process starts: { queue, handler, prefetch }
export const consumers = [
    { queue: QUEUES.email.name, handler: handleEmailEvent, prefetch: 10 },
    // Cloudinary calls are slow: fewer in flight per replica, scale out with more replicas
    { queue: QUEUES.media.name, handler: handleMediaJob, prefetch: 5 },
    { queue: QUEUES.audit.name, handler: handleAuditEvent, prefetch: 20 },
];
