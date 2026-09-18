import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLoading } from '../../context/LoadingContext';

interface Props {
  forcedLoading?: boolean;
  forcedMessage?: string | null;
}

export const GlobalLoadingBar: React.FC<Props> = ({ forcedLoading, forcedMessage }) => {
  const { isLoading: contextLoading } = useLoading();
  const isLoading = forcedLoading !== undefined ? forcedLoading : contextLoading;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999]">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-[2px] w-full bg-slate-800/50 relative overflow-hidden"
          >
            {/* Indeterminate sweeping progress indicator */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                ease: "easeInOut",
              }}
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-[#2AABEE] to-transparent shadow-[0_0_8px_rgba(42,171,238,0.5)]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
