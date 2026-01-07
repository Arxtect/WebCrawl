import { TeamFlags } from "../../../types";

type BlocklistBlob = {
  blocklist: string[];
  allowedKeywords: string[];
};

let blob: BlocklistBlob | null = null;

export async function initializeBlocklist() {
  blob = {
    blocklist: [],
    allowedKeywords: [],
  };
}

export function isUrlBlocked(url: string, flags: TeamFlags): boolean {
  if (blob === null) {
    throw new Error("Blocklist not initialized");
  }

  const lowerCaseUrl = url.trim().toLowerCase();

  let blockedlist = [...blob.blocklist];

  if (flags?.unblockedDomains) {
    blockedlist = blockedlist.filter(
      blocked => !flags.unblockedDomains!.includes(blocked),
    );
  }

  const decryptedUrl =
    blockedlist.find(decrypted => lowerCaseUrl === decrypted) || lowerCaseUrl;

  // If the URL is empty or invalid, return false
  let hostname: string | null = null;
  let publicSuffix: string | null = null;
  try {
    const parsed = new URL(decryptedUrl);
    hostname = parsed.hostname.replace(/^www\./, "");
    const parts = hostname.split(".");
    publicSuffix = parts.length >= 2 ? parts.slice(-1)[0] : null;
  } catch {
    console.log("Error parsing URL:", url);
    return false;
  }

  const domain = hostname;

  if (!domain) {
    return false;
  }

  // Check if URL contains any allowed keyword
  if (
    blob.allowedKeywords.some(keyword =>
      lowerCaseUrl.includes(keyword.toLowerCase()),
    )
  ) {
    return false;
  }

  // Block exact matches
  if (blockedlist.includes(domain)) {
    return true;
  }

  // Block subdomains
  if (blockedlist.some(blocked => domain.endsWith(`.${blocked}`))) {
    return true;
  }

  // Block different TLDs of the same base domain
  const baseDomain = domain.split(".")[0]; // Extract the base domain (e.g., "facebook" from "facebook.com")
  if (
    publicSuffix &&
    blockedlist.some(
      blocked => blocked.startsWith(baseDomain + ".") && blocked !== domain,
    )
  ) {
    return true;
  }

  return false;
}
