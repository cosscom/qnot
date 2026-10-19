import type { SVGProps } from 'react';

/** qnot's mark: a net's three knots on a line, then the name. */
export function Wordmark() {
  return (
    <>
      <svg aria-hidden className="size-6 shrink-0" fill="none" viewBox="0 0 24 24">
        <path d="M3 7h18M3 7l4.5 10M21 7l-4.5 10M12 7v10M7.5 17h9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        <path d="M5.2 12h13.6" stroke="currentColor" strokeLinecap="round" strokeOpacity=".45" strokeWidth="1.6" />
        <circle cx="12" cy="12" fill="currentColor" r="1.6" />
      </svg>
      <span>qnot</span>
    </>
  );
}

export function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
