import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Mounted under a path on a bigger site (coss.com/qnot): set NEXT_PUBLIC_BASE_PATH=/qnot.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') || undefined,
  // The workspace packages ship TypeScript source.
  transpilePackages: ['@qnot/core', '@qnot/react'],
  // Twoslash drives the TypeScript compiler while MDX compiles; it must not be bundled.
  serverExternalPackages: ['typescript', 'twoslash'],
  poweredByHeader: false,
  agentRules: false,
  async rewrites() {
    // Every docs page as Markdown for LLMs: /docs/foo.md → /llms.mdx/foo
    return [{ source: '/docs/:path*.md', destination: '/llms.mdx/:path*' }];
  },
};

export default createMDX()(nextConfig);
