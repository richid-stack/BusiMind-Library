import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLoading } from '../../context/LoadingContext';
import { Loader2, RefreshCw } from 'lucide-react';

interface Props {
  forcedLoading?: boolean;
  forcedMessage?: string | null;
}

export const GlobalLoadingBar: React.FC<Props> = ({ forcedLoading, forcedMessage }) => {
  const { isLoading: contextLoading, loadingMessage: contextMessage } = useLoading();

  const isLoading = forcedLoading !== undefined ? forcedLoading : contextLoading;
  const message = forcedMessage !== undefined ? forcedMessage : contextMessage;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999]">
      <AnimatePresence>
        {isLoading && (
          <>
            {/* Top Slim Shimmering Progress Bar */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-1 w-full origin-left bg-gradient-to-r from-[#ffd814] via-[#f3a847] to-[#c45500] shadow-[0_0_12px_rgba(243,168,71,0.8)]"
            >
              <div className="h-full w-full animate-shimmer opacity-75" />
            </motion.div>

            {/* Non-intrusive floating feedback pill */}
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto absolute right-4 top-4 flex items-center gap-2.5 rounded-full border border-amber-400/40 bg-[#131921]/95 px-4 py-1.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#f3a847]" />
                <span className="tracking-wide">{message}</span>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
