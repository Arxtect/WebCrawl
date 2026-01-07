import IPAddr from 'ipaddr.js';
import type {Socket} from 'net';
import type {TLSSocket} from 'tls';
import * as undici from 'undici';

import {config} from '../../../../config';

export class InsecureConnectionError extends Error {
  constructor() {
    super('Connection violated security rules.');
  }
}

export function isIPPrivate(address: string): boolean {
  if (!IPAddr.isValid(address)) return false;

  const addr = IPAddr.parse(address);
  return addr.range() !== 'unicast';
}

function createBaseAgent(skipTlsVerification: boolean) {
  const agentOpts: undici.Agent.Options = {};

  if (config.PROXY_SERVER) {
    return new undici.ProxyAgent({
      uri: config.PROXY_SERVER.includes('://') ?
          config.PROXY_SERVER :
          'http://' + config.PROXY_SERVER,
      token: config.PROXY_USERNAME ?
          `Basic ${
              Buffer
                  .from(
                      config.PROXY_USERNAME + ':' +
                      (config.PROXY_PASSWORD ?? ''))
                  .toString('base64')}` :
          undefined,
      requestTls: {
        rejectUnauthorized:
            !skipTlsVerification,  // Only bypass SSL verification if
                                   // explicitly requested
      },
      ...agentOpts,
    });
  }

  return new undici.Agent({
    connect: {
      rejectUnauthorized:
          !skipTlsVerification,  // Only bypass SSL verification if explicitly requested
    },
    ...agentOpts,
  });
}

function attachSecurityCheck(agent: undici.Dispatcher) {
  agent.on('connect', (_, targets) => {
    const client: undici.Client = targets.slice(-1)[0] as undici.Client;
    const socketSymbol = Object.getOwnPropertySymbols(client).find(
        x => x.description === 'socket',
        )!;
    const socket: Socket|TLSSocket = (client as any)[socketSymbol];

    if (socket.remoteAddress && isIPPrivate(socket.remoteAddress) &&
        config.ALLOW_LOCAL_WEBHOOKS !== true) {
      socket.destroy(new InsecureConnectionError());
    }
  });
}

function makeSecureDispatcher(skipTlsVerification: boolean) {
  const agent = createBaseAgent(skipTlsVerification);
  attachSecurityCheck(agent);
  return agent;
}

function makeSecureDispatcherNoCookies(skipTlsVerification: boolean) {
  const agent = createBaseAgent(skipTlsVerification);
  attachSecurityCheck(agent);
  return agent;
}

const secureDispatcher = makeSecureDispatcher(false);
const secureDispatcherSkipTlsVerification = makeSecureDispatcher(true);
const secureDispatcherNoCookies = makeSecureDispatcherNoCookies(false);
const secureDispatcherNoCookiesSkipTlsVerification =
    makeSecureDispatcherNoCookies(true);

export const getSecureDispatcher = (skipTlsVerification: boolean = false) =>
    skipTlsVerification ? secureDispatcherSkipTlsVerification :
                          secureDispatcher;

export const getSecureDispatcherNoCookies = (
    skipTlsVerification: boolean = false,
    ) => skipTlsVerification ? secureDispatcherNoCookiesSkipTlsVerification :
                               secureDispatcherNoCookies;
