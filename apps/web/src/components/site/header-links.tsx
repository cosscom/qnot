// Adapted from cosscom/coss apps/site/src/components/account-links.tsx (AGPL-3.0); see NOTICE.md.
import { Button } from '@/components/ui/button';
import { GITHUB_URL } from '@/lib/site';
import { ThemeToggle } from './theme-toggle';
import { GithubIcon } from './wordmark';

/**
 * The header's last cell, where coss.com puts "Sign in" and "Sign up": qnot has no accounts, so
 * the theme switch (ghost) and the repository (the cell's one filled button).
 */
export function HeaderLinks() {
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <Button render={<a href={GITHUB_URL} rel="noreferrer" target="_blank" />} size="sm">
        <GithubIcon />
        GitHub
      </Button>
    </div>
  );
}
