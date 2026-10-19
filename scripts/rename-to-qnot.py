# One-off rename sweep: trawlnet -> qnot. Run from the repo root.
import os, re, sys

ROOT = '.'
SKIP_DIRS = {'node_modules', '.git', 'dist', '.next', '.registry', '.svelte-kit', '.turbo'}
SKIP_PATHS = {'./apps/web/public/r', './apps/web/public/islands', './bench/dist'}
TEXT_EXT = {'.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.mdx', '.css', '.svelte', '.vue', '.yml', '.yaml', '.html', '.txt', '.py'}
SKIP_FILES = {'./pnpm-lock.yaml', './scripts/rename-to-qnot.py'}

REPO = 'https://github.com/sean-brydon/trawlnet'
TOKEN = '\u0000REPO_URL\u0000'

def sweep(s: str, path: str) -> str:
    s = s.replace(REPO, TOKEN).replace('sean-brydon/trawlnet', '\u0000REPO_SLUG\u0000')
    s = s.replace('@trawlnet/', '@qnot/')
    s = s.replace('TRAWLNET', 'QNOT').replace('Trawlnet', 'Qnot').replace('trawlnet', 'qnot')
    # CSS class prefix: only real class tokens (not btn-, data-…-tn- etc.).
    s = s.replace('data-tn-', 'data-qn-')
    s = re.sub(r'(?<![A-Za-z0-9_\-])tn-(?=[a-z])', 'qn-', s)
    if path.endswith(('.css',)) or 'styles' in path:
        s = re.sub(r'\.tn(?![A-Za-z0-9_\-])', '.qn', s)
    s = s.replace("root: 'tn'", "root: 'qn'")
    s = re.sub(r"(['\"`])\.tn(?![A-Za-z0-9_\-])", r'\1.qn', s)  # selectors in tests: '.tn', '.tn > …'
    s = re.sub(r"(['\"`])tn(['\"`])", r'\1qn\2', s)            # className 'tn'
    s = s.replace(TOKEN, REPO).replace('\u0000REPO_SLUG\u0000', 'sean-brydon/trawlnet')
    return s

changed = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and os.path.join(dirpath, d) not in SKIP_PATHS]
    for name in filenames:
        path = os.path.join(dirpath, name)
        if path in SKIP_FILES or os.path.splitext(name)[1] not in TEXT_EXT or name.endswith('.log'):
            continue
        try:
            src = open(path, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        out = sweep(src, path)
        if out != src:
            if '--dry' not in sys.argv:
                open(path, 'w', encoding='utf-8').write(out)
            changed.append(path)
print(f'{len(changed)} files changed')
for p in changed[:400]:
    print(' ', p)
