import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { routeEdge } from './src/edge-route.mjs';

// Preserve previously deployed class identities and data during cutover.
// These exports are not used by the replacement's request path or workers.
export class AIHackrContainer extends DurableObject {
  async fetch() { return new Response('Retired application', { status: 410 }); }
}
export class WebDataStore extends DurableObject {
  async fetch() { return new Response('Retired application', { status: 410 }); }
}
export class ContainerProxy extends WorkerEntrypoint {
  async fetch() { return new Response('Retired application', { status: 410 }); }
}
export default { fetch: (request, env) => routeEdge(request, env) };
