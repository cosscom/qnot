import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The workspace packages ship TypeScript source.
  transpilePackages: ['@trawlnet/core', '@trawlnet/react'],
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
