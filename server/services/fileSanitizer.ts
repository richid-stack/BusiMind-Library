/**
 * BusiMind File, Title, and Metadata Sanitizer
 * Strips foreign watermarks (OceanofPDF, Toaz, Libgen, PDFDrive, Feismo, WorldFreeBooks, etc.),
 * decodes reversed text, parses titles and authors, and formats clean filenames.
 */

// Known foreign distributor & pirate watermark patterns
const FOREIGN_WATERMARK_PATTERNS: RegExp[] = [
  /oceanofpdf(\.com|\s*com)?/gi,
  /ocean\s*pdf/gi,
  /toaz(\.info|\s*info)?/gi,
  /feismo(\.com|\s*com)?/gi,
  /worldfreebooks(\.com|\s*com)?/gi,
  /pdfdrive(\.com|\s*com)?/gi,
  /z-?library/gi,
  /zlib/gi,
  /libgen(\.(li|is|rs|io|lc|gs))?/gi,
  /vk\.com[_\w]*/gi,
  /b-ok(\.cc|\.org|\.lat)?/gi,
  /bookzz/gi,
  /sanet(\.st|\.lc)?/gi,
  /ebooks3000/gi,
  /allitebooks/gi,
  /freebookspot/gi,
  /litchart(s)?/gi,
  /www\.[a-z0-9-]+\.[a-z]{2,}/gi,
  /\[[a-z0-9_.-]+\.(com|org|net|ru|is|li)\]/gi,
  /\b[a-z0-9_.-]+\.(com|org|net|ru|is|li|st|cc)\b/gi,
  // Hashes & toaz / feismo signatures
  /\bpr\s+[a-f0-9]{8,}\b/gi,
  /\bpr[-_][a-f0-9]{8,}\b/gi,
  // File size & edition noise
  /\b\d+\s*pages\b/gi,
  /\bcompress(ed)?\b/gi,
  /\b(pdf|epub|mobi)\b/gi,
  /\bsecondnbsped\b/gi,
  /\b10th\s+anniversary\s+edition\b/gi,
  /\b13th\s+ed\b/gi,
  /\b\d+(st|nd|rd|th)\s+ed(ition)?\b/gi,
  /\bwith\s+study\s+guide\b/gi,
  /\bstudy\s+guide\b/gi,
  /\benhanced\s+edition\b/gi,
  /\brevis(ed)?\b/gi,
  /\bharper\s+collins\s+e\s+books\s*\d*\b/gi,
  /\b\d{10,13}\b/gi, // stray ISBN / barcodes in filename
];

/**
 * Detects and un-reverses text that was stored in reverse order
 * (e.g. "evol sremotsuc" -> "customers love", "ytraM nagaC" -> "Cagan Marty")
 */
export function unreverseIfNeeded(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  // Known reversed tokens commonly found in scanned libraries
  const reversedTokens = [
    'sremotsuc', 'derewopme', 'laed eht', 'gninniw', 'ytram', 'nagac',
    'senoj', 'sirhc', 'elpoep', 'yranidro', 'evitavonni'
  ];
  const lower = trimmed.toLowerCase();
  const isReversed = reversedTokens.some((tok) => lower.includes(tok));
  if (isReversed) {
    return trimmed.split('').reverse().join('');
  }
  return trimmed;
}

/**
 * Strips all foreign repository watermarks, timestamps, and messy noise from a filename or title string.
 */
export function stripForeignWatermarks(input: string): string {
  if (!input) return '';

  let cleaned = unreverseIfNeeded(input);

  // Strip leading date/time stamps (e.g. "01 11 2020 203418", "01_11_2020_203418", "5 ajold 2023")
  cleaned = cleaned.replace(/^\d{1,2}[\s._-]\d{1,2}[\s._-]\d{2,4}[\s._-]\d{4,8}\s*/i, '');
  cleaned = cleaned.replace(/^\d+[\s._-]ajold[\s._-]\d*\s*/i, '');

  // Strip foreign watermark patterns
  for (const pattern of FOREIGN_WATERMARK_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  // Replace underscores, hyphens in kebab-case, and dots with spaces
  cleaned = cleaned
    .replace(/[._]+/g, ' ')
    .replace(/(?<=[a-zA-Z0-9])-(?=[a-zA-Z0-9])/g, ' ') // convert word-word to word word
    .replace(/\s*-\s*/g, ' - ');

  // Clean remaining stray "com", "org", "info" tokens that stood alone
  cleaned = cleaned.replace(/\b(com|org|net|info|pr)\b/gi, ' ');

  // Collapse multiple spaces & dashes
  cleaned = cleaned
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s_.\-[\]()]+/, '')
    .replace(/[\s_.\-[\]()]+$/, '')
    .trim();

  return cleaned;
}

export interface ParsedBookMeta {
  title: string;
  author: string;
  category: string;
}

/**
 * Authoritative Dictionary of Famous Business/Strategy/Finance Classics
 * Matches common normalized substrings to clean canonical titles, authors, and categories.
 */
const KNOWN_CANONICAL_BOOKS: Array<{
  match: RegExp;
  title: string;
  author: string;
  category: string;
}> = [
  {
    match: /\b100m\s*[-_]?\s*leads\b/i,
    title: '$100M Leads: How to Get Strangers to Want to Buy Your Stuff',
    author: 'Alex Hormozi',
    category: 'Marketing & Sales',
  },
  {
    match: /\b100m\s*[-_]?\s*offers\b/i,
    title: '$100M Offers: How to Make Offers So Good People Feel Stupid Saying No',
    author: 'Alex Hormozi',
    category: 'Marketing & Sales',
  },
  {
    match: /\bzero\s+to\s+one\b/i,
    title: 'Zero to One: Notes on Startups, or How to Build the Future',
    author: 'Peter Thiel & Blake Masters',
    category: 'Entrepreneurship',
  },
  {
    match: /\b7\s+powers\b/i,
    title: '7 Powers: Foundations of Business Strategy',
    author: 'Hamilton Helmer',
    category: 'Strategy & Economics',
  },
  {
    match: /\brandom\s+walk\s+down\s+wall\s+street\b/i,
    title: 'A Random Walk Down Wall Street',
    author: 'Burton G. Malkiel',
    category: 'Money & Investing',
  },
  {
    match: /\bantifragile\b/i,
    title: 'Antifragile: Things That Gain from Disorder',
    author: 'Nassim Nicholas Taleb',
    category: 'Strategy & Economics',
  },
  {
    match: /\bbeating\s+the\s+street\b/i,
    title: 'Beating the Street',
    author: 'Peter Lynch',
    category: 'Money & Investing',
  },
  {
    match: /\bone\s+up\s+(on\s+)?wall\s+street\b/i,
    title: 'One Up On Wall Street',
    author: 'Peter Lynch',
    category: 'Money & Investing',
  },
  {
    match: /\bintelligent\s+investor\b/i,
    title: 'The Intelligent Investor',
    author: 'Benjamin Graham',
    category: 'Money & Investing',
  },
  {
    match: /\blean\s+startup\b/i,
    title: 'The Lean Startup',
    author: 'Eric Ries',
    category: 'Entrepreneurship',
  },
  {
    match: /\blittle\s+book\s+of\s+common\s+sense\b/i,
    title: 'The Little Book of Common Sense Investing',
    author: 'John C. Bogle',
    category: 'Money & Investing',
  },
  {
    match: /\bmillionaire\s+next\s+door\b/i,
    title: 'The Millionaire Next Door',
    author: 'Thomas J. Stanley & William D. Danko',
    category: 'Money & Investing',
  },
  {
    match: /\bmom\s+test\b/i,
    title: 'The Mom Test: How to Talk to Customers When Everyone Is Lying to You',
    author: 'Rob Fitzpatrick',
    category: 'Entrepreneurship',
  },
  {
    match: /\bpersonal\s+mba\b/i,
    title: 'The Personal MBA: Master the Art of Business',
    author: 'Josh Kaufman',
    category: 'Entrepreneurship',
  },
  {
    match: /\brichest\s+man\s+in\s+babylon\b/i,
    title: 'The Richest Man in Babylon',
    author: 'George S. Clason',
    category: 'Money & Investing',
  },
  {
    match: /\bstartup\s+owner(')?s\s+manual\b/i,
    title: "The Startup Owner's Manual: The Step-By-Step Guide for Building a Great Company",
    author: 'Steve Blank & Bob Dorf',
    category: 'Entrepreneurship',
  },
  {
    match: /\bthinking,?\s+fast\s+and\s+slow\b/i,
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    category: 'Mindset & Psychology',
  },
  {
    match: /\bdisciplined\s+entrepreneurship\b/i,
    title: 'Disciplined Entrepreneurship: 24 Steps to a Successful Startup',
    author: 'Bill Aulet',
    category: 'Entrepreneurship',
  },
  {
    match: /\bprofit\s+first\b/i,
    title: 'Profit First: Transform Your Business from a Cash-Eating Monster to a Money-Making Machine',
    author: 'Mike Michalowicz',
    category: 'Finance & Economics',
  },
  {
    match: /\bspin\s+selling\b/i,
    title: 'SPIN Selling',
    author: 'Neil Rackham',
    category: 'Marketing & Sales',
  },
  {
    match: /\btraction(\b|\s+how\s+any\s+startup)/i,
    title: 'Traction: How Any Startup Can Achieve Rapid Customer Growth',
    author: 'Gabriel Weinberg & Justin Mares',
    category: 'Marketing & Sales',
  },
  {
    match: /\bblue\s+ocean\s+stra/i,
    title: 'Blue Ocean Strategy',
    author: 'W. Chan Kim & Renée Mauborgne',
    category: 'Strategy & Economics',
  },
  {
    match: /\bblue\s+ocean\s+shift\b/i,
    title: 'Blue Ocean Shift',
    author: 'W. Chan Kim & Renée Mauborgne',
    category: 'Strategy & Economics',
  },
  {
    match: /\bzen\s+in\s+the\s+art\s+of\s+writing\b/i,
    title: 'Zen in the Art of Writing',
    author: 'Ray Bradbury',
    category: 'Mindset & Psychology',
  },
  {
    match: /\band\s+then\s+there\s+were\s+none\b/i,
    title: 'And Then There Were None',
    author: 'Agatha Christie',
    category: 'Mindset & Psychology',
  },
  {
    match: /\bhard\s+thing\s+about\s+hard\s+things?\b/i,
    title: 'The Hard Thing About Hard Things: Building a Business When There Are No Easy Answers',
    author: 'Ben Horowitz',
    category: 'Leadership & Management',
  },
  {
    match: /\binnovator(')?s\s+dilemma\b/i,
    title: "The Innovator's Dilemma: When New Technologies Cause Great Firms to Fail",
    author: 'Clayton M. Christensen',
    category: 'Strategy & Economics',
  },
  {
    match: /\bmillionaire\s+fastlane\b/i,
    title: 'The Millionaire Fastlane: Crack the Code to Wealth and Live Rich for a Lifetime',
    author: 'MJ DeMarco',
    category: 'Money & Investing',
  },
  {
    match: /\bpsychology\s+of\s+money\b/i,
    title: 'The Psychology of Money: Timeless Lessons on Wealth, Greed, and Happiness',
    author: 'Morgan Housel',
    category: 'Money & Investing',
  },
  {
    match: /\beffective\s+executive\b/i,
    title: 'The Effective Executive: The Definitive Guide to Getting the Right Things Done',
    author: 'Peter F. Drucker',
    category: 'Leadership & Management',
  },
  {
    match: /\belements\s+of\s+style\b/i,
    title: 'The Elements of Style',
    author: 'William Strunk Jr. & E.B. White',
    category: 'Mindset & Psychology',
  },
  {
    match: /\bemotion\s+thesaurus\b/i,
    title: 'The Emotion Thesaurus: A Writer’s Guide to Character Expression',
    author: 'Angela Ackerman & Becca Puglisi',
    category: 'Mindset & Psychology',
  },
  {
    match: /\bfive\s+dysfunctions\s+of\s+a\s+team\b/i,
    title: 'The Five Dysfunctions of a Team',
    author: 'Patrick Lencioni',
    category: 'Leadership & Management',
  },
  {
    match: /\bthe\s+goal\b/i,
    title: 'The Goal: A Process of Ongoing Improvement',
    author: 'Eliyahu M. Goldratt & Jeff Cox',
    category: 'Strategy & Economics',
  },
  {
    match: /\bgraphic\s+design\s+book\b/i,
    title: 'The Graphic Design Book: A Comprehensive Guide for Beginners',
    author: 'Curated Design Press',
    category: 'Marketing & Sales',
  },
  {
    match: /\bsecrets\s+to\s+writing\s+a\s+successful\s+business\s+plan\b/i,
    title: 'The Secrets to Writing a Successful Business Plan',
    author: 'Hal Shelton',
    category: 'Entrepreneurship',
  },
  {
    match: /\bultralearning\b/i,
    title: 'Ultralearning: Master Hard Skills, Outsmart the Competition, and Accelerate Your Career',
    author: 'Scott H. Young',
    category: 'Mindset & Psychology',
  },
  {
    match: /\b(man'?s\s+search\s+for\s+meaning|viktor\s+(e\.?\s+)?frankl)\b/i,
    title: "Man's Search for Meaning",
    author: 'Viktor E. Frankl',
    category: 'Mindset & Psychology',
  },
  {
    match: /\brichest\s+ma(n)?(\s+in\s+babylon)?\b/i,
    title: 'The Richest Man in Babylon',
    author: 'George S. Clason',
    category: 'Money & Investing',
  },
  {
    match: /\bawakening\s+the\s+entrepreneur\b/i,
    title: 'Awakening the Entrepreneur Within',
    author: 'Michael E. Gerber',
    category: 'Entrepreneurship',
  },
  {
    match: /\b(the\s+)?e[\s-_]*myth\b/i,
    title: 'The E-Myth Revisited: Why Most Small Businesses Don’t Work and What to Do About It',
    author: 'Michael E. Gerber',
    category: 'Entrepreneurship',
  },
  {
    match: /\bbuilt\s+to\s+last\b/i,
    title: 'Built to Last: Successful Habits of Visionary Companies',
    author: 'Jim Collins & Jerry I. Porras',
    category: 'Leadership & Management',
  },
  {
    match: /\bgood\s+to\s+great\b/i,
    title: 'Good to Great: Why Some Companies Make the Leap and Others Don’t',
    author: 'Jim Collins',
    category: 'Leadership & Management',
  },
  {
    match: /\bhigh\s+output\s+management\b/i,
    title: 'High Output Management',
    author: 'Andrew S. Grove',
    category: 'Leadership & Management',
  },
  {
    match: /\binfluence(\b|\s+robert\s+b\s+cialdini)/i,
    title: 'Influence: The Psychology of Persuasion',
    author: 'Robert B. Cialdini',
    category: 'Mindset & Psychology',
  },
  {
    match: /\bintroduction\s+to\s+algorithms\b/i,
    title: 'Introduction to Algorithms',
    author: 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest & Clifford Stein',
    category: 'Strategy & Economics',
  },
  {
    match: /\brich\s+dad\s+poor\s+dad\b/i,
    title: 'Rich Dad Poor Dad: What the Rich Teach Their Kids About Money',
    author: 'Robert T. Kiyosaki',
    category: 'Money & Investing',
  },
  {
    match: /\bcrossing\s+the\s+chasm\b/i,
    title: 'Crossing the Chasm: Marketing and Selling Disruptive Products to Mainstream Customers',
    author: 'Geoffrey A. Moore',
    category: 'Marketing & Sales',
  },
  {
    match: /\bhands\s+on\s+machine\s+learning\b/i,
    title: 'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow',
    author: 'Aurélien Géron',
    category: 'Strategy & Economics',
  },
  {
    match: /\bbusiness\s+model\s+generation\b/i,
    title: 'Business Model Generation: A Handbook for Visionaries, Game Changers, and Challengers',
    author: 'Alexander Osterwalder & Yves Pigneur',
    category: 'Strategy & Economics',
  },
  {
    match: /\bvalue\s+proposition\s+design\b/i,
    title: 'Value Proposition Design: How to Create Products and Services Customers Want',
    author: 'Alexander Osterwalder, Yves Pigneur, Greg Bernarda & Alan Smith',
    category: 'Strategy & Economics',
  },
  {
    match: /\bchase\s+the\s+lion\b/i,
    title: "Chase the Lion: If Your Dream Doesn't Scare You, It's Too Small",
    author: 'Mark Batterson',
    category: 'Mindset & Psychology',
  },
  {
    match: /\bdead\s+aid\b/i,
    title: 'Dead Aid: Why Aid Is Not Working and How There Is a Better Way for Africa',
    author: 'Dambisa Moyo',
    category: 'Finance & Economics',
  },
  {
    match: /\binspired(\b|.*marty\s+cagan)/i,
    title: 'Inspired: How to Create Tech Products Customers Love',
    author: 'Marty Cagan',
    category: 'Strategy & Economics',
  },
  {
    match: /\bempowered(\b|.*marty\s+cagan)/i,
    title: 'Empowered: Ordinary People, Extraordinary Products',
    author: 'Marty Cagan & Chris Jones',
    category: 'Leadership & Management',
  },
  {
    match: /\bpitch\s+anything\b/i,
    title: 'Pitch Anything: An Innovative Method for Presenting, Persuading, and Winning the Deal',
    author: 'Oren Klaff',
    category: 'Marketing & Sales',
  },
  {
    match: /\blead\s+and\s+disrupt\b/i,
    title: "Lead and Disrupt: How to Solve the Innovator's Dilemma",
    author: 'Charles A. O’Reilly III & Michael L. Tushman',
    category: 'Leadership & Management',
  },
  {
    match: /\b101\s+great\s+answers\b/i,
    title: '101 Great Answers to the Toughest Interview Questions',
    author: 'Ron Fry',
    category: 'Leadership & Management',
  },
  {
    match: /\bafrica\s+rising\b/i,
    title: 'Africa Rising: How 900 Million African Consumers Offer More Than You Think',
    author: 'Vijay Mahajan',
    category: 'Finance & Economics',
  },
  {
    match: /\bautomate\s+the\s+boring\s+stuff\b/i,
    title: 'Automate the Boring Stuff with Python',
    author: 'Al Sweigart',
    category: 'Strategy & Economics',
  },
  {
    match: /\bthinking\s+in\s+systems\b/i,
    title: 'Thinking in Systems: A Primer',
    author: 'Donella H. Meadows',
    category: 'Strategy & Economics',
  },
  {
    match: /\bmost\s+important\s+thing\b/i,
    title: 'The Most Important Thing: Uncommon Sense for the Thoughtful Investor',
    author: 'Howard Marks',
    category: 'Money & Investing',
  },
  {
    match: /\b(the\s+)?one\s+thing\b/i,
    title: 'The ONE Thing: The Surprisingly Simple Truth About Extraordinary Results',
    author: 'Gary Keller & Jay Papasan',
    category: 'Leadership & Management',
  },
  {
    match: /\b(ten|10)x?\s+rule|ten\s+times\s+rule\b/i,
    title: 'The 10X Rule: The Only Difference Between Success and Failure',
    author: 'Grant Cardone',
    category: 'Marketing & Sales',
  },
  {
    match: /\bwhat\s+works\s+on\s+wall\s+street\b/i,
    title: 'What Works on Wall Street',
    author: 'James P. O’Shaughnessy',
    category: 'Money & Investing',
  },
  {
    match: /\bstock\s+market\s+genius\b/i,
    title: 'You Can Be a Stock Market Genius',
    author: 'Joel Greenblatt',
    category: 'Money & Investing',
  },
  {
    match: /\byour\s+money\s+and\s+your\s+brain\b/i,
    title: 'Your Money and Your Brain',
    author: 'Jason Zweig',
    category: 'Mindset & Psychology',
  },
  {
    match: /\bon\s+writing\s+well\b/i,
    title: 'On Writing Well: The Classic Guide to Writing Nonfiction',
    author: 'William Zinsser',
    category: 'Mindset & Psychology',
  },
  {
    match: /\boption\s+b\b/i,
    title: 'Option B: Facing Adversity, Building Resilience, and Finding Joy',
    author: 'Sheryl Sandberg & Adam Grant',
    category: 'Mindset & Psychology',
  },
  {
    match: /\bcashflow\s+quadrant\b/i,
    title: "Rich Dad's CASHFLOW Quadrant: Guide to Financial Freedom",
    author: 'Robert T. Kiyosaki',
    category: 'Money & Investing',
  },
  {
    match: /\bscaling\s+up\b/i,
    title: 'Scaling Up: How a Few Companies Make It... and Why the Rest Don’t',
    author: 'Verne Harnish',
    category: 'Leadership & Management',
  },
  {
    match: /\bshoe\s+dog\b/i,
    title: 'Shoe Dog: A Memoir by the Creator of Nike',
    author: 'Phil Knight',
    category: 'Entrepreneurship',
  },
  {
    match: /\bsprint\b.*jake\s+knapp/i,
    title: 'Sprint: How to Solve Big Problems and Test New Ideas in Just Five Days',
    author: 'Jake Knapp, John Zeratsky & Braden Kowitz',
    category: 'Strategy & Economics',
  },
  {
    match: /\bstart\s+with\s+why\b/i,
    title: 'Start with Why: How Great Leaders Inspire Everyone to Take Action',
    author: 'Simon Sinek',
    category: 'Leadership & Management',
  },
  {
    match: /\b7\s+habits\s+of\s+highly\s+effective\s+people\b/i,
    title: 'The 7 Habits of Highly Effective People',
    author: 'Stephen R. Covey',
    category: 'Mindset & Psychology',
  },
  {
    match: /\b80\s*[-/]?\s*20\s+principle\b/i,
    title: 'The 80/20 Principle: The Secret to Achieving More with Less',
    author: 'Richard Koch',
    category: 'Strategy & Economics',
  },
  {
    match: /\bmad\s+genius\b/i,
    title: 'Mad Genius: A Manifesto for Entrepreneurs',
    author: 'Randy Gage',
    category: 'Entrepreneurship',
  },
  {
    match: /\b(win|wim)\s+every\s+argument\b/i,
    title: 'Win Every Argument: The Art of Debating, Persuading, and Public Speaking',
    author: 'Mehdi Hasan',
    category: 'Marketing & Sales',
  },
  {
    match: /\brunning\s+lean\b/i,
    title: 'Running Lean: Iterate from Plan A to a Plan That Works',
    author: 'Ash Maurya',
    category: 'Entrepreneurship',
  },
  {
    match: /\bmathematics\s+of\s+ai\b/i,
    title: 'The Mathematics of Artificial Intelligence',
    author: 'Research Monograph Series',
    category: 'Strategy & Economics',
  },
];

/**
 * Parses raw text or filename into clean title, author, and category.
 */
export function parseTitleAndAuthorFromRaw(rawText: string): ParsedBookMeta {
  const cleaned = stripForeignWatermarks(rawText);

  // 1. Check against our high-precision known book database
  for (const known of KNOWN_CANONICAL_BOOKS) {
    if (known.match.test(cleaned) || known.match.test(rawText)) {
      return {
        title: known.title,
        author: known.author,
        category: known.category,
      };
    }
  }

  // 2. Heuristic extraction: "Title - Author" or "Title by Author"
  let title = cleaned;
  let author = 'Curated Library';
  let category = 'Entrepreneurship';

  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    if (parts.length >= 2) {
      title = parts[0].trim();
      author = parts[1].trim();
    }
  } else if (/\bby\s+/i.test(cleaned)) {
    const parts = cleaned.split(/\bby\s+/i);
    if (parts.length >= 2) {
      title = parts[0].trim();
      author = parts[1].trim();
    }
  }

  // Clean title formatting (capitalize nicely)
  title = title
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-_\s]+|[-_\s]+$/g, '')
    .trim();

  // If author contains extra text or digits, clean it
  author = author
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-_\s]+|[-_\s]+$/g, '')
    .trim();

  // Deduce category if possible
  const lowerTitle = title.toLowerCase();
  if (/invest|money|wall street|wealth|stock|finance|rich dad|bogle/i.test(lowerTitle)) {
    category = 'Money & Investing';
  } else if (/startup|founder|entrepreneur|lean|zero to one|business plan/i.test(lowerTitle)) {
    category = 'Entrepreneurship';
  } else if (/sales|marketing|traction|leads|offers|influence|pitch/i.test(lowerTitle)) {
    category = 'Marketing & Sales';
  } else if (/leader|management|executive|team|dysfunctions/i.test(lowerTitle)) {
    category = 'Leadership & Management';
  } else if (/mindset|psychology|thinking|meaning|ultralearning/i.test(lowerTitle)) {
    category = 'Mindset & Psychology';
  } else if (/strategy|powers|dilemma|algorithm|python|ai/i.test(lowerTitle)) {
    category = 'Strategy & Economics';
  }

  return { title: title || 'Business Knowledge Asset', author: author || 'Curated Library', category };
}

// Alias for backwards compatibility
export const cleanRawTitleAndAuthor = parseTitleAndAuthorFromRaw;

/**
 * Sanitizes any raw uploaded/forwarded filename into a standardized BusiMind branded filename.
 * Example:
 * Input:  "OceanofPDF.com_The_Lean_Startup_-_Eric_Ries.pdf"
 * Output: "[BusiMind] The Lean Startup - Eric Ries.pdf"
 */
export function sanitizeBookFileName(
  rawFileName?: string,
  canonicalTitle?: string,
  canonicalAuthor?: string
): string {
  // Determine file extension (default to .pdf)
  let extension = '.pdf';
  if (rawFileName) {
    const extMatch = rawFileName.match(/\.([a-z0-9]{2,5})$/i);
    if (extMatch) {
      extension = `.${extMatch[1].toLowerCase()}`;
    }
  }

  let finalTitle = canonicalTitle;
  let finalAuthor = canonicalAuthor;

  // If title/author not provided, parse from raw filename
  if (!finalTitle && rawFileName) {
    const parsed = parseTitleAndAuthorFromRaw(rawFileName.replace(/\.[^/.]+$/, ''));
    finalTitle = parsed.title;
    finalAuthor = parsed.author;
  }

  if (finalTitle) {
    let cleanTitle = stripForeignWatermarks(finalTitle)
      .replace(/[:/\\*?"<>|]/g, ' ') // filesystem illegal chars
      .replace(/\s{2,}/g, ' ')
      .trim();

    let cleanAuthor = finalAuthor ? stripForeignWatermarks(finalAuthor) : '';
    cleanAuthor = cleanAuthor
      .replace(/[:/\\*?"<>|]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const authorPart = cleanAuthor && cleanAuthor !== 'Curated' && cleanAuthor !== 'Channel Library' && cleanAuthor !== 'Curated Library'
      ? ` - ${cleanAuthor}`
      : '';

    return `[BusiMind] ${cleanTitle}${authorPart}${extension}`;
  }

  return `[BusiMind] Business Knowledge Asset${extension}`;
}

/**
 * Generates an authoritative BusiMind delivery caption for Telegram copyMessage / sendDocument
 */
export function generateDeliveryCaption(
  bookTitle: string,
  author?: string,
  cleanFileName?: string
): string {
  const fileLabel = cleanFileName || sanitizeBookFileName(undefined, bookTitle, author);
  const authorLine = author && author !== 'Channel Library' && author !== 'Curated Library' ? `✍️ Author: ${author}\n` : '';

  return `📚 *[BusiMind Edition] ${bookTitle}*\n` +
    authorLine +
    `📄 File: \`${fileLabel}\`\n\n` +
    `⏳ *SELF-DESTRUCT TIMER: 2 MINUTES*\n` +
    `⚠️ This file will be automatically deleted from this chat in 2 minutes.\n` +
    `📲 *Forward to your "Saved Messages" now to keep it permanently!*`;
}
