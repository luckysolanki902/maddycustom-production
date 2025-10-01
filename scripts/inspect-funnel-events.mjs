import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const EXPECTED_STEPS = [
  'visit',
  'view_product',
  'add_to_cart',
  'apply_offer',
  'view_cart_drawer',
  'open_order_form',
  'address_tab_open',
  'initiate_checkout',
  'contact_info',
  'payment_initiated',
  'purchase',
];

const DEFAULT_LIMIT = 5;
const DEFAULT_INTERVAL_MS = 5000;

function tryLoadEnvValue(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return null;
  const key = trimmed.slice(0, eqIndex).trim();
  if (!key) return null;
  const value = trimmed.slice(eqIndex + 1).trim();
  return { key, value };
}

function loadEnv() {
  if (process.env.MONGODB_URI) {
    return;
  }

  const candidates = ['.env.local', '.env'];
  for (const candidate of candidates) {
    const envPath = path.join(rootDir, candidate);
    if (!fs.existsSync(envPath)) continue;
    const fileContents = fs.readFileSync(envPath, 'utf8');
    const lines = fileContents.split(/\r?\n/);
    for (const line of lines) {
      const entry = tryLoadEnvValue(line);
      if (!entry) continue;
      const { key, value } = entry;
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
    if (process.env.MONGODB_URI) {
      return;
    }
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not present in environment or .env files');
  }
}

function parseInterval(input) {
  if (!input) {
    return DEFAULT_INTERVAL_MS;
  }

  const value = input.trim().toLowerCase();
  const endsWithMs = value.endsWith('ms');
  const endsWithS = value.endsWith('s');

  let numeric;
  if (endsWithMs) {
    numeric = Number(value.slice(0, -2));
  } else if (endsWithS) {
    numeric = Number(value.slice(0, -1));
    if (Number.isFinite(numeric)) {
      numeric *= 1000;
    }
  } else {
    numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0 && numeric < 50) {
      // Treat small integers as seconds for convenience
      numeric *= 1000;
    }
  }

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid interval value: ${input}`);
  }

  return numeric;
}

function parseArgs(argv) {
  const options = {
    watch: false,
    interval: DEFAULT_INTERVAL_MS,
    sessionId: null,
    visitorId: null,
    limit: DEFAULT_LIMIT,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--session':
      case '-s': {
        if (i + 1 >= argv.length) {
          throw new Error('--session requires a value');
        }
        options.sessionId = argv[i + 1];
        i += 1;
        break;
      }
      case '--visitor':
      case '-v': {
        if (i + 1 >= argv.length) {
          throw new Error('--visitor requires a value');
        }
        options.visitorId = argv[i + 1];
        i += 1;
        break;
      }
      case '--limit':
      case '-l': {
        if (i + 1 >= argv.length) {
          throw new Error('--limit requires a value');
        }
        const value = Number.parseInt(argv[i + 1], 10);
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error('--limit must be a positive integer');
        }
        options.limit = value;
        i += 1;
        break;
      }
      case '--interval':
      case '-i': {
        if (i + 1 >= argv.length) {
          throw new Error('--interval requires a value');
        }
        options.interval = parseInterval(argv[i + 1]);
        i += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function showHelp() {
  console.log(`Usage: node scripts/inspect-funnel-events.mjs [options]\n\nOptions:\n  -h, --help            Show this help message\n  -w, --watch           Continuously poll for new events\n  -i, --interval <ms>   Poll interval in ms (supports values like 5000, 5s)\n  -s, --session <id>    Focus on a specific sessionId\n  -v, --visitor <id>    Filter sessions by visitorId\n  -l, --limit <n>       Number of sessions to list (default: 5)\n\nExamples:\n  node scripts/inspect-funnel-events.mjs\n  node scripts/inspect-funnel-events.mjs --watch --session 123 --interval 3s\n`);
}

function maskPhone(phone) {
  if (!phone) return undefined;
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length <= 4) return `***${normalized}`;
  const last4 = normalized.slice(-4);
  return `***${last4}`;
}

function summarizeSession(session) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    visitorId: session.visitorId,
    userId: session.userId ? session.userId.toString() : undefined,
    lastActivityAt: session.lastActivityAt,
    revisits: session.revisits,
    hasContact: Boolean(session?.metadata?.contact?.phoneNumber || session?.metadata?.contact?.email),
    contactPhone: maskPhone(session?.metadata?.contact?.phoneNumber || ''),
    contactEmail: session?.metadata?.contact?.email,
    utmSource: session?.utm?.source,
    utmCampaign: session?.utm?.campaign,
    landingPath: session?.landingPage?.path,
  };
}

function calculateMissingSteps(events) {
  const seen = new Set(events.map((event) => event.step));
  return EXPECTED_STEPS.filter((step) => !seen.has(step));
}

function buildMetadataPreview(metadata) {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const keys = ['form', 'transition', 'paymentMode', 'amountDueOnline', 'paymentStatus', 'couponApplied'];
  const preview = {};
  keys.forEach((key) => {
    if (metadata[key] !== undefined) {
      preview[key] = metadata[key];
    }
  });
  if (metadata.user?.phoneNumber) {
    preview.userPhone = maskPhone(metadata.user.phoneNumber);
  }
  if (metadata.user?.userId) {
    preview.userId = metadata.user.userId;
  }
  return Object.keys(preview).length > 0 ? preview : undefined;
}

function describeEvent(event) {
  const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
  const parts = [`[${timestamp}] step=${event.step}`];
  if (event.page?.path) parts.push(`page=${event.page.path}`);
  if (event.product?.id) parts.push(`product=${event.product.id}`);
  if (event.cart?.items) parts.push(`cartItems=${event.cart.items}`);
  if (event.cart?.value) parts.push(`cartValue=${event.cart.value}`);
  if (event.order?.orderId) parts.push(`order=${event.order.orderId}`);
  const metadataPreview = buildMetadataPreview(event.metadata);
  if (metadataPreview) {
    parts.push(`metadata=${JSON.stringify(metadataPreview)}`);
  }
  return parts.join(' ');
}

function getEventKey(event) {
  if (event._id) {
    return event._id.toString();
  }
  if (event.eventId) {
    return `${event.sessionId}:${event.eventId}`;
  }
  const timePart = event.timestamp ? new Date(event.timestamp).getTime() : Date.now();
  return `${event.sessionId}:${event.step}:${timePart}`;
}

async function fetchSessions(FunnelSession, options) {
  const filter = {};
  if (options.visitorId) {
    filter.visitorId = options.visitorId;
  }
  if (options.sessionId) {
    filter.sessionId = options.sessionId;
  }

  const query = FunnelSession.find(filter).sort({ lastActivityAt: -1 });
  if (!options.sessionId) {
    query.limit(options.limit);
  } else if (options.limit > 0) {
    query.limit(Math.max(options.limit, 5));
  }

  const sessions = await query.lean();

  if (options.sessionId && !sessions.some((session) => session.sessionId === options.sessionId)) {
    const direct = await FunnelSession.findOne({ sessionId: options.sessionId }).lean();
    if (direct) {
      sessions.unshift(direct);
    }
  }

  return sessions;
}

async function renderCycle(context, options, state) {
  const { FunnelSession, FunnelEvent } = context;
  const sessions = await fetchSessions(FunnelSession, options);

  if (!sessions.length) {
    console.log('No funnel sessions found in the database.');
    return;
  }

  const targetSession = options.sessionId
    ? sessions.find((session) => session.sessionId === options.sessionId) || sessions[0]
    : sessions[0];

  if (!targetSession) {
    console.log('No matching session found yet.');
    return;
  }

  if (state.currentSessionId !== targetSession.sessionId) {
    if (state.currentSessionId) {
      console.log(`Switched to session ${targetSession.sessionId}`);
    }
    state.currentSessionId = targetSession.sessionId;
    state.seenEventKeys.clear();
    state.firstCycle = true;
  }

  const signature = sessions.map((session) => session.sessionId).join('|');
  if (!options.watch || state.lastSessionSignature !== signature) {
    console.log('Latest funnel sessions (masked contact info):');
    const sessionSummaries = sessions.slice(0, options.limit).map((session) => ({
      ...summarizeSession(session),
      target: session.sessionId === targetSession.sessionId ? '★' : '',
    }));
    console.table(sessionSummaries);
    state.lastSessionSignature = signature;
  }

  const filter = { sessionId: targetSession.sessionId };
  if (options.visitorId) {
    filter.visitorId = options.visitorId;
  }

  const events = await FunnelEvent.find(filter).sort({ timestamp: 1 }).lean();

  console.log(`\nInspecting events for sessionId ${targetSession.sessionId} (visitorId ${targetSession.visitorId})`);

  if (!events.length) {
    console.log('No events linked to this session yet.');
    return;
  }

  const seenSteps = Array.from(new Set(events.map((event) => event.step)));
  const missingSteps = calculateMissingSteps(events);
  console.log(`Steps observed: ${seenSteps.join(', ')}`);
  if (missingSteps.length) {
    console.log(`Still missing: ${missingSteps.join(', ')}`);
  } else {
    console.log('All core funnel steps observed for this session.');
  }

  const lines = [];
  for (const event of events) {
    const key = getEventKey(event);
    const isNew = !state.seenEventKeys.has(key);
    if (!options.watch || isNew || state.firstCycle) {
      lines.push({ event, isNew });
    }
    state.seenEventKeys.add(key);
  }

  if (!lines.length && options.watch && !state.firstCycle) {
    console.log('No new events since last check.');
  } else {
    for (const { event, isNew } of lines) {
      const prefix = isNew && !state.firstCycle ? '[NEW] ' : ' - ';
      console.log(`${prefix}${describeEvent(event)}`);
    }
  }

  state.firstCycle = false;
}

async function bootstrap(options) {
  loadEnv();

  const { default: connectToDatabase } = await import('../src/lib/middleware/connectToDb.js');
  const { default: FunnelSession } = await import('../src/models/analytics/FunnelSession.js');
  const { default: FunnelEvent } = await import('../src/models/analytics/FunnelEvent.js');

  const mongooseInstance = await connectToDatabase();

  const context = { FunnelSession, FunnelEvent };
  const state = {
    lastSessionSignature: null,
    currentSessionId: null,
    seenEventKeys: new Set(),
    firstCycle: true,
  };

  const executeCycle = async () => {
    try {
      await renderCycle(context, options, state);
    } catch (error) {
      console.error('Error inspecting funnel events:', error);
    }
  };

  if (options.watch) {
    console.log(`Watching for funnel updates every ${options.interval}ms...`);
    await executeCycle();
    let running = false;
    const intervalId = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        console.log(`\n[${new Date().toLocaleTimeString()}] Polling funnel events...`);
        await executeCycle();
      } finally {
        running = false;
      }
    }, options.interval);

    const cleanup = async () => {
      clearInterval(intervalId);
      try {
        await mongooseInstance.connection.close();
      } catch (error) {
        console.error('Failed to close Mongo connection:', error);
      }
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } else {
    await executeCycle();
    await mongooseInstance.connection.close();
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    showHelp();
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    showHelp();
    return;
  }

  try {
    await bootstrap(options);
  } catch (error) {
    console.error('Error inspecting funnel events:', error);
    process.exitCode = 1;
  }
}

main();
