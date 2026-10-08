// The raw SQL guard (architecture §6.4). Questions the spec cannot express
// may come with SQL; it runs only if this conservative check passes. It is
// plain TypeScript, so it behaves the same in both adapters and needs no
// extension (D-036). When in doubt it refuses.
//
// Passes only: one statement, starting SELECT or WITH; no keyword that
// writes, loads or changes settings; every function on an allow-list; every
// table read is the workspace table or a CTE defined in the statement. The
// result is wrapped in an outer SELECT with LIMIT 1000.

export const GUARD_ROW_LIMIT = 1000;
export const GUARD_TIMEOUT_MS = 5000;
const MAX_LENGTH = 10_000;

export type GuardResult = { ok: true; sql: string } | { ok: false; reason: string };

type Token =
  | { kind: 'word'; text: string; lower: string }
  | { kind: 'quoted'; text: string }
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'punct'; text: string };

const DENIED = new Set([
  'insert',
  'update',
  'delete',
  'merge',
  'upsert',
  'create',
  'drop',
  'alter',
  'attach',
  'detach',
  'copy',
  'export',
  'import',
  'install',
  'load',
  'pragma',
  'set',
  'reset',
  'call',
  'checkpoint',
  'vacuum',
  'truncate',
  'grant',
  'revoke',
  'begin',
  'commit',
  'rollback',
  'transaction',
  'use',
  'execute',
  'prepare',
  'deallocate',
  'summarize',
  'describe',
  'show',
  'returning',
  'into',
]);

const FUNCTIONS = new Set([
  // aggregates
  'sum',
  'avg',
  'mean',
  'count',
  'min',
  'max',
  'median',
  'mode',
  'quantile',
  'quantile_cont',
  'quantile_disc',
  'percentile_cont',
  'percentile_disc',
  'stddev',
  'stddev_samp',
  'stddev_pop',
  'variance',
  'var_samp',
  'var_pop',
  'corr',
  'covar_pop',
  'covar_samp',
  'first',
  'last',
  'any_value',
  'arg_max',
  'arg_min',
  'max_by',
  'min_by',
  'string_agg',
  'bool_and',
  'bool_or',
  'count_if',
  'approx_count_distinct',
  'product',
  'mad',
  // windows
  'row_number',
  'rank',
  'dense_rank',
  'percent_rank',
  'cume_dist',
  'ntile',
  'lag',
  'lead',
  'first_value',
  'last_value',
  'nth_value',
  // numbers
  'abs',
  'round',
  'floor',
  'ceil',
  'ceiling',
  'sqrt',
  'power',
  'pow',
  'ln',
  'log',
  'log10',
  'log2',
  'exp',
  'sign',
  'greatest',
  'least',
  'nullif',
  'coalesce',
  'ifnull',
  'isnan',
  'isfinite',
  'cast',
  'try_cast',
  'if',
  'iff',
  // text
  'lower',
  'upper',
  'trim',
  'ltrim',
  'rtrim',
  'length',
  'substr',
  'substring',
  'replace',
  'concat',
  'concat_ws',
  'left',
  'right',
  'starts_with',
  'ends_with',
  'contains',
  'strpos',
  'instr',
  'lpad',
  'rpad',
  'regexp_matches',
  'regexp_replace',
  'regexp_extract',
  'split_part',
  'levenshtein',
  // dates
  'date_trunc',
  'date_part',
  'extract',
  'year',
  'month',
  'day',
  'quarter',
  'week',
  'dayofweek',
  'isodow',
  'dayofyear',
  'hour',
  'minute',
  'strftime',
  'strptime',
  'try_strptime',
  'make_date',
  'date_diff',
  'datediff',
  'date_add',
  'last_day',
  'monthname',
  'dayname',
]);

/** Keywords that may stand before "(" without being a function call. */
const PAREN_KEYWORDS = new Set([
  'in',
  'exists',
  'as',
  'over',
  'filter',
  'from',
  'join',
  'using',
  'any',
  'all',
  'not',
  'and',
  'or',
  'select',
  'where',
  'on',
  'by',
  'within',
  'values',
  'when',
  'then',
  'else',
  'case',
  'having',
  'union',
  'except',
  'intersect',
  'is',
  'between',
  'like',
  'ilike',
  'distinct',
]);

/** Keywords that end a FROM clause's list of tables. */
const FROM_ENDS = new Set([
  'where',
  'group',
  'order',
  'limit',
  'having',
  'qualify',
  'window',
  'union',
  'except',
  'intersect',
  'on',
  'using',
  'select',
  'offset',
]);

const JOIN_WORDS = new Set(['join']);

function tokenize(sql: string): Token[] | string {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end + 1;
    } else if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) return 'a comment is not closed';
      i = end + 2;
    } else if (ch === "'") {
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) return 'a string is not closed';
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") j += 2;
          else break;
        } else j++;
      }
      tokens.push({ kind: 'string' });
      i = j + 1;
    } else if (ch === '"') {
      let j = i + 1;
      let text = '';
      for (;;) {
        if (j >= sql.length) return 'a quoted name is not closed';
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') {
            text += '"';
            j += 2;
          } else break;
        } else text += sql[j++];
      }
      tokens.push({ kind: 'quoted', text });
      i = j + 1;
    } else if (ch === '$') {
      return 'dollar quoting and parameters are not allowed';
    } else if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
      const text = sql.slice(i, j);
      tokens.push({ kind: 'word', text, lower: text.toLowerCase() });
      i = j;
    } else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(next ?? ''))) {
      let j = i;
      while (j < sql.length && /[0-9.eE]/.test(sql[j])) j++;
      tokens.push({ kind: 'number' });
      i = j;
    } else {
      tokens.push({ kind: 'punct', text: ch });
      i++;
    }
  }
  return tokens;
}

const refuse = (reason: string): GuardResult => ({ ok: false, reason });

/** Checks `sql` and returns it wrapped for running, or the reason it is refused. */
export function guardSql(sql: string, table: string): GuardResult {
  if (sql.length > MAX_LENGTH) return refuse('The statement is too long.');
  const tokens = tokenize(sql);
  if (typeof tokens === 'string') return refuse(`The statement cannot be read: ${tokens}.`);

  // One statement: a single trailing semicolon at most.
  const semis = tokens.flatMap((t, i) => (t.kind === 'punct' && t.text === ';' ? [i] : []));
  if (semis.length > 1 || (semis.length === 1 && semis[0] !== tokens.length - 1)) {
    return refuse('Only one statement can run.');
  }
  const body = semis.length ? tokens.slice(0, -1) : tokens;
  if (body.length === 0) return refuse('The statement is empty.');
  const first = body[0];
  if (first.kind !== 'word' || (first.lower !== 'select' && first.lower !== 'with')) {
    return refuse('Only SELECT statements can run.');
  }

  // Names a CTE defines: a word just before "AS (" or "AS MATERIALIZED (".
  const ctes = new Set<string>();
  body.forEach((t, i) => {
    const as = body[i + 1];
    const after = body[i + 2];
    const after2 = body[i + 3];
    if (
      (t.kind === 'word' || t.kind === 'quoted') &&
      as?.kind === 'word' &&
      as.lower === 'as' &&
      ((after?.kind === 'punct' && after.text === '(') ||
        (after?.kind === 'word' &&
          (after.lower === 'materialized' || after.lower === 'not') &&
          after2 !== undefined))
    ) {
      ctes.add(t.kind === 'word' ? t.lower : t.text.toLowerCase());
    }
  });
  const allowedTable = (name: string) => name === table.toLowerCase() || ctes.has(name);

  let depth = 0;
  // Depth at which a FROM list is open, or -1.
  const fromAt: number[] = [];
  let expectTable = false;
  for (let i = 0; i < body.length; i++) {
    const t = body[i];
    const nextTok = body[i + 1];
    const opens = nextTok?.kind === 'punct' && nextTok.text === '(';

    if (expectTable) {
      expectTable = false;
      if (t.kind === 'punct' && t.text === '(') {
        depth++;
        continue;
      }
      const name = t.kind === 'word' ? t.lower : t.kind === 'quoted' ? t.text.toLowerCase() : null;
      if (name === null) return refuse('A table must follow FROM or JOIN.');
      if (opens) return refuse('Table functions are not allowed.');
      if (nextTok?.kind === 'punct' && nextTok.text === '.') {
        return refuse('Only the workspace table can be read.');
      }
      if (!allowedTable(name)) return refuse(`Only the ${table} table can be read, not ${name}.`);
      continue;
    }

    if (t.kind === 'word') {
      if (DENIED.has(t.lower)) return refuse(`${t.text.toUpperCase()} is not allowed.`);
      if (opens && !PAREN_KEYWORDS.has(t.lower) && !FUNCTIONS.has(t.lower)) {
        return refuse(`The function ${t.text} is not allowed.`);
      }
      if (t.lower === 'from' || JOIN_WORDS.has(t.lower)) {
        // "DISTINCT FROM" and "EXTRACT(x FROM y)" are not table lists.
        const prev = body[i - 1];
        const inCall = prev?.kind === 'word' && (prev.lower === 'distinct' || prev.lower === 'is');
        if (!inCall && !(t.lower === 'from' && insideCall(body, i))) {
          expectTable = true;
          if (t.lower === 'from') fromAt.push(depth);
        }
      } else if (FROM_ENDS.has(t.lower) && fromAt.at(-1) === depth) {
        fromAt.pop();
      }
    } else if (t.kind === 'quoted' && opens) {
      return refuse('Functions must be named plainly.');
    } else if (t.kind === 'punct') {
      if (t.text === '(') depth++;
      else if (t.text === ')') {
        while (fromAt.length && fromAt.at(-1)! >= depth) fromAt.pop();
        depth--;
        if (depth < 0) return refuse('The brackets do not match.');
      } else if (t.text === ',' && fromAt.at(-1) === depth) {
        expectTable = true;
      }
    }
  }
  if (depth !== 0) return refuse('The brackets do not match.');
  if (expectTable) return refuse('A table must follow FROM or JOIN.');

  const inner = sql.trim().replace(/;\s*$/, '');
  return {
    ok: true,
    sql: `SELECT * FROM (\n${inner}\n) AS guarded LIMIT ${GUARD_ROW_LIMIT}`,
  };
}

/** True when token `i` sits directly inside a call such as extract( ... FROM ... ). */
function insideCall(tokens: Token[], i: number): boolean {
  let depth = 0;
  for (let j = i - 1; j >= 0; j--) {
    const t = tokens[j];
    if (t.kind !== 'punct') continue;
    if (t.text === ')') depth++;
    else if (t.text === '(') {
      if (depth === 0) {
        const before = tokens[j - 1];
        return (
          before?.kind === 'word' &&
          (before.lower === 'extract' || before.lower === 'substring' || before.lower === 'trim')
        );
      }
      depth--;
    }
  }
  return false;
}

/** Runs a promise with the guard's time limit. */
export function withTimeout<T>(promise: Promise<T>, ms = GUARD_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`The query took longer than ${ms / 1000} seconds and was stopped.`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
