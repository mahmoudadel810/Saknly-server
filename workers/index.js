import { QUEUES } from '../services/queue/topology.js';
import { handleEmailEvent } from './emailWorker.js';

// Consumers the worker process starts: { queue, handler, prefetch }
export const consumers = [
    { queue: QUEUES.email.name, handler: handleEmailEvent, prefetch: 10 },
];
