export interface PairingData {
  code: string;
  uid: string;
  bookId?: string;
  createdAt: number;
  expiresAt: number;
}

class PairingStore {
  private pairings: Map<string, PairingData> = new Map();

  // Generate a random 6-digit numeric pairing code (e.g. "492815")
  createPairing(uid: string, bookId?: string): string {
    this.cleanExpired();

    // Remove any existing active pairing for this uid
    for (const [existingCode, data] of this.pairings.entries()) {
      if (data.uid === uid) {
        this.pairings.delete(existingCode);
      }
    }

    // Generate unique 6-digit code
    let code = '';
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.pairings.has(code));

    const now = Date.now();
    const data: PairingData = {
      code,
      uid,
      bookId,
      createdAt: now,
      expiresAt: now + 20 * 60 * 1000, // 20 minutes validity
    };

    this.pairings.set(code, data);
    return code;
  }

  getPairing(code: string): PairingData | null {
    this.cleanExpired();
    const clean = code.trim().replace(/\s+/g, '');
    const data = this.pairings.get(clean);
    if (!data) return null;
    if (Date.now() > data.expiresAt) {
      this.pairings.delete(clean);
      return null;
    }
    return data;
  }

  consumePairing(code: string): PairingData | null {
    const clean = code.trim().replace(/\s+/g, '');
    const data = this.getPairing(clean);
    if (data) {
      this.pairings.delete(clean);
    }
    return data;
  }

  private cleanExpired() {
    const now = Date.now();
    for (const [code, data] of this.pairings.entries()) {
      if (now > data.expiresAt) {
        this.pairings.delete(code);
      }
    }
  }
}

export const pairingStore = new PairingStore();
