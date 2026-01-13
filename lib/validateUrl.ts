// SSRF-safe URL validation

import { URL } from 'url';

/**
 * Validates URL and blocks SSRF attempts
 * Throws error if URL is unsafe
 */
export function validateUrl(urlString: string): URL {
  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow http and https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  const hostname = url.hostname.toLowerCase();

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    throw new Error('Cannot fetch localhost');
  }

  // Block private IP ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = hostname.match(ipv4Regex);

  if (ipMatch) {
    const octets = ipMatch.slice(1).map(Number);

    // 10.0.0.0/8
    if (octets[0] === 10) {
      throw new Error('Private IP address not allowed');
    }

    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      throw new Error('Private IP address not allowed');
    }

    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) {
      throw new Error('Private IP address not allowed');
    }

    // 169.254.0.0/16 (link-local)
    if (octets[0] === 169 && octets[1] === 254) {
      throw new Error('Link-local address not allowed');
    }

    // Cloud metadata IPs
    // AWS: 169.254.169.254
    if (octets[0] === 169 && octets[1] === 254 && octets[2] === 169 && octets[3] === 254) {
      throw new Error('Metadata endpoint not allowed');
    }
  }

  // Block internal domains
  const blockedDomains = ['internal', 'local', 'intranet'];
  if (blockedDomains.some(blocked => hostname.includes(blocked))) {
    throw new Error('Internal domain not allowed');
  }

  return url;
}
