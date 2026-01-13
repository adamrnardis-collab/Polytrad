// SSRF Protection - Prevent Server-Side Request Forgery attacks

import { URL } from 'url';

const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::]',
  '::1',
];

const PRIVATE_IP_RANGES = [
  /^10\./,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,              // 192.168.0.0/16
  /^169\.254\./,              // 169.254.0.0/16 (link-local)
  /^127\./,                   // 127.0.0.0/8 (loopback)
  /^fc00:/i,                  // fc00::/7 (IPv6 unique local)
  /^fe80:/i,                  // fe80::/10 (IPv6 link-local)
  /^::1$/,                    // ::1 (IPv6 loopback)
  /^::ffff:127\./i,           // IPv4-mapped IPv6 loopback
];

// AWS metadata endpoints
const METADATA_IPS = [
  '169.254.169.254',
  '169.254.170.2',
  'fd00:ec2::254',
];

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Validates a URL to prevent SSRF attacks
 * @param urlString - The URL to validate
 * @throws {SSRFError} If the URL is potentially dangerous
 * @returns {URL} Parsed URL object if safe
 */
export function validateURL(urlString: string): URL {
  let parsedURL: URL;

  try {
    parsedURL = new URL(urlString);
  } catch (error) {
    throw new SSRFError('Invalid URL format');
  }

  // Only allow http and https protocols
  if (!['http:', 'https:'].includes(parsedURL.protocol)) {
    throw new SSRFError(`Protocol ${parsedURL.protocol} is not allowed. Only http and https are permitted.`);
  }

  const hostname = parsedURL.hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new SSRFError(`Access to ${hostname} is not allowed`);
  }

  // Check metadata IPs
  if (METADATA_IPS.includes(hostname)) {
    throw new SSRFError('Access to cloud metadata endpoints is not allowed');
  }

  // Check private IP ranges
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      throw new SSRFError(`Access to private IP range is not allowed: ${hostname}`);
    }
  }

  // Check for IPv4 addresses that resolve to private ranges
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    const parts = hostname.split('.').map(Number);

    // Check for invalid octets
    if (parts.some(part => part > 255)) {
      throw new SSRFError('Invalid IPv4 address');
    }

    // Additional checks for special ranges
    if (parts[0] === 0 || parts[0] === 255) {
      throw new SSRFError('Invalid IPv4 address range');
    }
  }

  // Check URL length
  if (urlString.length > 2048) {
    throw new SSRFError('URL is too long');
  }

  return parsedURL;
}

/**
 * Additional runtime check for redirects
 * Call this after following redirects to ensure the final URL is safe
 */
export function validateRedirectURL(finalURL: string, originalURL: string): void {
  const validated = validateURL(finalURL);

  // Ensure we didn't get redirected to a different protocol
  const originalProtocol = new URL(originalURL).protocol;
  if (validated.protocol !== originalProtocol && originalProtocol === 'https:') {
    throw new SSRFError('HTTPS to HTTP downgrade detected in redirect');
  }
}

/**
 * Sanitize and validate headers to prevent header injection
 */
export function getSafeHeaders(): HeadersInit {
  return {
    'User-Agent': 'PromptMirror/1.0 (Web Analysis Bot)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };
}
