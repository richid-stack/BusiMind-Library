import React, { useState } from 'react';
import { X, HelpCircle, ChevronDown, ChevronUp, BookOpen, Send, LineChart, Smartphone, Sparkles, Shield } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenBookRequest: () => void;
}

interface FAQItem {
  question: string;
  answer: React.ReactNode;
  category: 'books' | 'telegram' | 'finance' | 'general';
  icon: React.ElementType;
}

export const FaqModal: React.FC<Props> = ({ isOpen, onClose, onOpenBookRequest }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState<'all' | 'books' | 'telegram' | 'finance'>('all');

  if (!isOpen) return null;

  const faqs: FAQItem[] = [
    {
      category: 'books',
      icon: BookOpen,
      question: 'What is BusiMind Library?',
      answer: (
        <p>
          BusiMind Library is a curated executive repository combining 170+ foundational business, investment, economics, and leadership literature with an institutional financial valuation terminal and an academic research index. It provides instant Kindle-style executive summaries, mental models, and direct delivery.
        </p>
      ),
    },
    {
      category: 'telegram',
      icon: Send,
      question: 'How does Telegram Delivery work?',
      answer: (
        <p>
          When browsing any title in the library, simply click <strong>&quot;Get on Telegram&quot;</strong>. If you are using our Telegram Mini App inside Telegram, the bot immediately transmits the book directly to your active chat. If accessing via a web browser, the app generates a direct Telegram deep link (<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">t.me/BusiMind_bot</code>) that automatically presents your requested book upon opening.
        </p>
      ),
    },
    {
      category: 'telegram',
      icon: Smartphone,
      question: 'Can I use BusiMind Library inside Telegram on mobile?',
      answer: (
        <p>
          Yes! BusiMind Library is fully optimized as a Telegram Mini App (TMA). When you launch the web store from the bot, it opens seamlessly within Telegram with full-height native mobile support, touch-optimized swipeable carousels, and zero extra sign-in required.
        </p>
      ),
    },
    {
      category: 'finance',
      icon: LineChart,
      question: 'How does the Financial Terminal calculate Bank of Ghana hurdle rates?',
      answer: (
        <p>
          Our DCF and Cost of Capital models dynamically incorporate Bank of Ghana Monetary Policy Rate (MPR) benchmarks (currently 29.00%) and 91-Day Treasury Bill yields (24.85%). For GSE equities (like MTN Ghana and GCB Bank), discount rates are benchmarked to local sovereign risk-free hurdles to prevent cross-border valuation distortion.
        </p>
      ),
    },
    {
      category: 'books',
      icon: Sparkles,
      question: 'What are Mental Models and how are they extracted?',
      answer: (
        <p>
          Mental models are cognitive decision-making frameworks derived from seminal literature (e.g., Charlie Munger&apos;s Inversion, Porter&apos;s Five Forces, Kahneman&apos;s System 1 & 2). In BusiMind Library, our RAG engine automatically maps these frameworks to real-world corporate situations and investment analysis.
        </p>
      ),
    },
    {
      category: 'books',
      icon: BookOpen,
      question: 'Can I request missing business books or academic papers?',
      answer: (
        <div>
          <p className="mb-2">
            Yes! If a book or research paper is not currently indexed in the catalog, submit a request through our community wishlist:
          </p>
          <button
            onClick={() => {
              onClose();
              onOpenBookRequest();
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#007185] hover:text-[#c45500] hover:underline"
          >
            Click here to submit a Book Wishlist Request →
          </button>
        </div>
      ),
    },
    {
      category: 'general',
      icon: Shield,
      question: 'Why are some technical and administrative tabs locked?',
      answer: (
        <p>
          BusiMind Library is open to the public for literature discovery, academic research, and valuation modeling. However, administrative management tools (such as Telegram bot token setup, channel webhook configuration, deletion controls, and raw system ingestion logs) are strictly restricted to authorized curators via the Curator Portal.
        </p>
      ),
    },
  ];

  const filteredFaqs = activeCategory === 'all' ? faqs : faqs.filter((f) => f.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white text-[#0f1111] rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#131921] text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#f3a847]/20 border border-[#f3a847]/30 text-[#f3a847]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Frequently Asked Questions</h2>
              <p className="text-xs text-gray-300">BusiMind Library Help & Documentation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
              activeCategory === 'all'
                ? 'bg-[#131921] text-white font-bold'
                : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            All Questions
          </button>
          <button
            onClick={() => setActiveCategory('books')}
            className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
              activeCategory === 'books'
                ? 'bg-[#131921] text-white font-bold'
                : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            Books & Reading
          </button>
          <button
            onClick={() => setActiveCategory('telegram')}
            className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
              activeCategory === 'telegram'
                ? 'bg-[#131921] text-white font-bold'
                : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            Telegram & Mobile App
          </button>
          <button
            onClick={() => setActiveCategory('finance')}
            className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
              activeCategory === 'finance'
                ? 'bg-[#131921] text-white font-bold'
                : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            Financial Terminal
          </button>
        </div>

        {/* Scrollable FAQ Accordion */}
        <div className="p-6 overflow-y-auto space-y-3 text-sm leading-relaxed custom-scrollbar">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const Icon = faq.icon;

            return (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg overflow-hidden transition-all bg-white hover:border-gray-300 shadow-xs"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left p-4 flex items-center justify-between gap-3 font-semibold text-[#0f1111] hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-[#f3a847] shrink-0" />
                    <span className="text-sm">{faq.question}</span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-gray-600 bg-slate-50/60 border-t border-gray-100">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex items-center justify-between text-xs">
          <span className="text-gray-500">Need more assistance?</span>
          <button
            onClick={() => {
              onClose();
              onOpenBookRequest();
            }}
            className="text-[#007185] hover:text-[#c45500] font-bold hover:underline"
          >
            Submit a Title Request →
          </button>
        </div>
      </div>
    </div>
  );
};
