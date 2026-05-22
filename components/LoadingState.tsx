"use client";

import { motion } from "framer-motion";

interface LoadingStateProps {
  steps: string[];
  currentStep: string | null;
}

export function LoadingState({ steps, currentStep }: LoadingStateProps) {
  const completed = currentStep
    ? steps.filter((s) => s !== currentStep)
    : steps;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-6 py-8"
    >
      <div className="text-center">
        <p className="text-lg font-medium text-gray-900">Creating your article</p>
        <p className="mt-1 text-sm text-gray-500">
          This may take 3–5 minutes. You can keep this tab open.
        </p>
      </div>

      {currentStep && (
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 rounded-xl bg-violet-50 px-4 py-3"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" />
          </span>
          <p className="text-sm font-medium text-violet-900">{currentStep}</p>
        </motion.div>
      )}

      {completed.length > 0 && (
        <ul className="mx-auto w-full max-w-md space-y-2">
          {completed.map((step, i) => (
            <motion.li
              key={`${step}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-2.5 text-sm text-gray-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="mt-0.5 h-4 w-4 shrink-0 text-teal-500"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{step}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
