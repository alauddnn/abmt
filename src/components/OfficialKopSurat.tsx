import React from 'react';
import {
  KOP_COMPANY_NAME,
  KOP_TAGLINE,
  KOP_ADDRESS,
  KOP_CONTACT,
  KOP_LOGO_URL,
} from '../lib/kopSuratLogo';

interface OfficialKopSuratProps {
  className?: string;
  compact?: boolean;
}

export const OfficialKopSurat: React.FC<OfficialKopSuratProps> = ({
  className = '',
  compact = false,
}) => {
  return (
    <div className={`w-full bg-white select-none ${className}`}>
      <div className="flex items-center gap-4 sm:gap-6 pb-3">
        {/* Left Logo */}
        <div className="shrink-0 flex items-center justify-center pl-1 sm:pl-2">
          <img
            src={KOP_LOGO_URL}
            alt={KOP_COMPANY_NAME}
            className={compact ? 'w-20 h-20 object-contain' : 'w-24 h-24 sm:w-28 sm:h-28 object-contain'}
          />
        </div>

        {/* Centered Company Identity Block (matching reference PDF) */}
        <div className="flex-1 text-center pr-2 sm:pr-10">
          <h1
            className={`${
              compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
            } font-extrabold tracking-wide uppercase text-[#0B3070] leading-tight`}
          >
            {KOP_COMPANY_NAME}
          </h1>
          <p
            className={`${
              compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-[13px]'
            } font-bold uppercase tracking-wider text-[#BE870F] mt-1`}
          >
            {KOP_TAGLINE}
          </p>
          <p className="text-[11px] sm:text-xs text-[#323232] mt-1 leading-snug">
            {KOP_ADDRESS}
          </p>
          <p className="text-[11px] sm:text-xs text-[#323232] mt-0.5 leading-snug">
            {KOP_CONTACT}
          </p>
        </div>
      </div>

      {/* Official Double Horizontal Line (Navy thick top + Gold thin bottom) */}
      <div className="w-full">
        <div className="w-full h-[2.5px] bg-[#0B3070]" />
        <div className="w-full h-[1px] bg-[#DDAA22] mt-[3px]" />
      </div>
    </div>
  );
};
