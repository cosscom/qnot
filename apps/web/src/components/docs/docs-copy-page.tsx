'use client';
import { CheckIcon, ChevronDownIcon, CopyIcon, ExternalLinkIcon, FileTextIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Group, GroupSeparator } from '@/components/ui/group';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { SITE_URL } from '@/lib/site';
import { useCopy } from '@/lib/use-copy';

/** "Copy Markdown" (the same rendering as /llms-full.txt), plus the page as Markdown and open-in-LLM links. */
export function DocsCopyPage({ page, markdownUrl }: { page: string; markdownUrl: string }) {
  const { copied, copy } = useCopy();
  const absolute = `${SITE_URL}${markdownUrl}`;
  const prompt = encodeURIComponent(`Read ${absolute} and help me with qnot.`);
  return (
    <Group>
      <Button onClick={() => copy(page)} size="xs" variant="outline">
        {copied ? <CheckIcon /> : <CopyIcon />}
        Copy Markdown
      </Button>
      <GroupSeparator />
      <Menu>
        <MenuTrigger render={<Button aria-label="More ways to read this page" size="icon-xs" variant="outline" />}>
          <ChevronDownIcon />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem render={<a href={markdownUrl} rel="noreferrer" target="_blank" />}>
            <FileTextIcon /> View as Markdown
          </MenuItem>
          <MenuItem render={<a href={`https://chatgpt.com/?q=${prompt}`} rel="noreferrer" target="_blank" />}>
            <ExternalLinkIcon /> Open in ChatGPT
          </MenuItem>
          <MenuItem render={<a href={`https://claude.ai/new?q=${prompt}`} rel="noreferrer" target="_blank" />}>
            <ExternalLinkIcon /> Open in Claude
          </MenuItem>
        </MenuPopup>
      </Menu>
    </Group>
  );
}
