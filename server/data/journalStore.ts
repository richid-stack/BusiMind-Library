import { JournalEntry } from '../../src/types';

/**
 * In-memory & Persistent Investment Journal Store
 * Allows tracking investment theses, review checkpoints, and book principles applied over time.
 */

const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'entry-mtngh-01',
    symbol: 'MTNGH',
    assetName: 'MTN Ghana (Scancom PLC)',
    action: 'BUY',
    entryPrice: 2.45,
    targetPrice: 3.40,
    stopOrReviewPrice: 2.10,
    currency: 'GHS',
    thesis: 'High free cash flow conversion (>80%), entrenched mobile money (MoMo) network moat with pricing power during inflation. Yielding over 7.5% dividend.',
    invalidationCriteria: 'Mobile Money transaction levy increase or regulatory tariff cap that contracts operating EBITDA margins below 45%.',
    appliedBooks: [
      'The Intelligent Investor (Benjamin Graham)',
      "Poor Charlie's Almanack (Charlie Munger)",
      'Investment Valuation (Aswath Damodaran)',
    ],
    status: 'active',
    createdAt: '2026-08-15T10:30:00.000Z',
    lastReviewedAt: '2026-09-01T14:00:00.000Z',
  },
  {
    id: 'entry-nvda-02',
    symbol: 'NVDA',
    assetName: 'NVIDIA Corporation',
    action: 'WATCH',
    entryPrice: 128.50,
    targetPrice: 155.00,
    stopOrReviewPrice: 105.00,
    currency: 'USD',
    thesis: 'CUDA software ecosystem represents a high-switching-cost moat (Helmer 7 Powers). Monitor customer CapEx digestion cycle before adding to core position.',
    invalidationCriteria: 'Hyperscaler cloud customers reducing AI GPU capital expenditure guidance by >15% year-over-year.',
    appliedBooks: [
      '7 Powers: The Foundations of Business Strategy (Hamilton Helmer)',
      'One Up On Wall Street (Peter Lynch)',
    ],
    status: 'active',
    createdAt: '2026-08-28T09:15:00.000Z',
    lastReviewedAt: '2026-09-04T16:20:00.000Z',
  },
];

class JournalStore {
  private entries: Map<string, JournalEntry> = new Map();

  constructor() {
    for (const entry of INITIAL_JOURNAL_ENTRIES) {
      this.entries.set(entry.id, entry);
    }
  }

  public getAll(): JournalEntry[] {
    return Array.from(this.entries.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getById(id: string): JournalEntry | undefined {
    return this.entries.get(id);
  }

  public add(entry: Omit<JournalEntry, 'id' | 'createdAt'>): JournalEntry {
    const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newEntry: JournalEntry = {
      ...entry,
      id,
      createdAt: new Date().toISOString(),
    };
    this.entries.set(id, newEntry);
    return newEntry;
  }

  public update(id: string, updates: Partial<JournalEntry>): JournalEntry | undefined {
    const existing = this.entries.get(id);
    if (!existing) return undefined;

    const updated = {
      ...existing,
      ...updates,
      lastReviewedAt: new Date().toISOString(),
    };
    this.entries.set(id, updated);
    return updated;
  }

  public delete(id: string): boolean {
    return this.entries.delete(id);
  }
}

export const journalStore = new JournalStore();
