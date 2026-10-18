import { JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * Cal Sans (https://github.com/calcom/sans, SIL OFL 1.1, licence in src/fonts/OFL.txt): the coss.com
 * sites' body and heading face, as `--font-sans`.
 */
export const fontSans = localFont({
  display: 'swap',
  src: [
    { path: '../fonts/CalSansVF.woff2', style: 'normal' },
    { path: '../fonts/CalSansVF-Italic.woff2', style: 'italic' },
  ],
  variable: '--font-sans',
  weight: '400 700',
});

/** JetBrains Mono (SIL OFL 1.1) for code and monospace labels, as on coss.com/shipyard. */
export const fontMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
