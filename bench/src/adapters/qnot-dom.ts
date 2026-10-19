// By path rather than a bench dependency; esbuild resolves symlinks, so core stays one module.
import { mountQueryBuilder } from '../../../packages/dom/src/index';
import { qnotAdapter } from './_qnot';
import { install } from '../runner';

install(qnotAdapter('@qnot/dom', (el, store) => mountQueryBuilder(el, store)));
