import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function BottomSheetHandle({ className = '', ...dragHandlers }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`flex justify-center -mt-2 pt-2 pb-4 touch-none cursor-grab active:cursor-grabbing ${className}`}
      {...dragHandlers}
    >
      <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
    </div>
  );
}
