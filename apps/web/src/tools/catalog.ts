// The free converter tools at /tools/<slug>: what each converts, its sample, and its copy.
// Server-safe (no React): the pages, sitemap, footer and OG images all read it.
import type { FormatId } from './formats';

export interface ToolFaq {
  q: string;
  a: string;
}

export interface Tool {
  slug: string;
  from: FormatId;
  /** Output formats; the first is the default, more than one shows tabs. */
  to: FormatId[];
  /** Page heading and the search term it targets: "SQL to MongoDB converter". */
  title: string;
  /** <title>, search term first. */
  metaTitle: string;
  /** Meta description, 140–160 characters. */
  description: string;
  /** One line under the heading. */
  lede: string;
  /** Short link text for the footer, sitemap and llms.txt. */
  label: string;
  sample: string;
  /** What the conversion does, a few short paragraphs. */
  notes: string[];
  faq: ToolFaq[];
}

const PRIVACY: ToolFaq = {
  q: 'Is my query sent anywhere?',
  a: 'No. The converter is qnot running in your browser: parsing, schema inference and conversion all happen on this page, and nothing you paste leaves your browser.',
};

const SCHEMA: ToolFaq = {
  q: 'Why does it show a schema?',
  a: "qnot's codecs are typed by a schema. The tool infers a permissive one from your input (numbers, booleans, dates, lists, nested arrays), so you can paste any query. In your app you declare the fields once with defineFields and get the same conversion with exact types.",
};

export const TOOLS: Tool[] = [
  {
    slug: 'sql-to-mongodb',
    from: 'sql',
    to: ['mongo'],
    title: 'SQL to MongoDB converter',
    metaTitle: 'SQL to MongoDB Query Converter (Free, Online)',
    description:
      'Convert a SQL WHERE clause to a MongoDB filter online: IN, BETWEEN, LIKE, IS NULL, AND/OR and NOT become $in, $gte, $regex and $or. Free, runs in your browser.',
    lede: 'Paste a WHERE clause, or a whole SELECT, and get the MongoDB filter document that matches the same rows.',
    label: 'SQL to MongoDB',
    sample: `SELECT * FROM users
WHERE status = 'active'
  AND age BETWEEN 21 AND 65
  AND (plan IN ('pro', 'team') OR email LIKE '%@acme.com')
  AND signed_up >= '2026-01-01'
  AND deleted_at IS NULL`,
    notes: [
      "The WHERE clause is parsed into qnot's query tree, then written out with the mongo codec. Comparisons map to $eq, $ne, $lt, $gte; IN and NOT IN to $in and $nin; BETWEEN to a $gte/$lte pair; IS NULL to null.",
      'LIKE patterns become anchored, escaped regular expressions: a leading and trailing % is contains, a trailing % starts-with, a leading % ends-with. Patterns with _ or an inner % are refused rather than guessed.',
      'Dates stay ISO strings. If your collection stores BSON dates, wrap them with new Date() in your app, or declare the field as f.date() and convert in one place.',
    ],
    faq: [
      PRIVACY,
      {
        q: 'Which SQL does it understand?',
        a: 'WHERE conditions: comparisons, IN, BETWEEN, LIKE/ILIKE, IS [NOT] NULL, AND, OR, NOT and parentheses, with quoted identifiers and string, number and boolean literals. Joins, subqueries and placeholders like $1 are not part of a filter and are refused with an error.',
      },
      SCHEMA,
    ],
  },
  {
    slug: 'mongodb-to-sql',
    from: 'mongo',
    to: ['sql'],
    title: 'MongoDB to SQL converter',
    metaTitle: 'MongoDB to SQL Query Converter (Free, Online)',
    description:
      'Turn a MongoDB filter into a SQL WHERE clause for Postgres, MySQL, SQLite or SQL Server, with inline values or bound parameters. Free and runs in your browser.',
    lede: 'Paste a find() filter, shell syntax welcome, and get the WHERE clause for your database, inline or parameterized.',
    label: 'MongoDB to SQL',
    sample: `db.orders.find({
  status: { $in: ["paid", "shipped"] },
  total: { $gte: 50, $lte: 500 },
  $or: [
    { "customer.country": "US" },
    { coupon: { $regex: "^VIP" } }
  ],
  cancelled_at: null
})`,
    notes: [
      'The filter is read with the mongo codec: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $regex (anchored or contains), $and, $or, $nor, $not and $elemMatch. Shell syntax is accepted: unquoted keys, single quotes, regex literals and ISODate().',
      'Choose the SQL dialect and how values are written. Inline values are escaped per dialect so they mean the same under every server setting; numbered, positional or named placeholders return the values separately for your driver to bind.',
      '$elemMatch becomes an array group. SQL can only express it on Postgres (as EXISTS over jsonb_array_elements); other dialects say so instead of dropping the condition.',
    ],
    faq: [
      PRIVACY,
      {
        q: 'Which MongoDB operators are supported?',
        a: 'Comparison operators, $in/$nin, $regex, $and/$or/$nor/$not, $all and $elemMatch, plus $expr forms that qnot itself writes. Operators with no SQL equivalent in a filter, such as $exists, $where or $text, are reported as errors.',
      },
      {
        q: 'Is the generated SQL safe to run?',
        a: 'Values are escaped for the chosen dialect, and LIKE patterns match literally. For queries built from user input, pick a placeholder style and pass the values to your driver as bound parameters.',
      },
    ],
  },
  {
    slug: 'sql-to-jsonlogic',
    from: 'sql',
    to: ['jsonlogic'],
    title: 'SQL to JsonLogic converter',
    metaTitle: 'SQL to JsonLogic Converter (Free, Online)',
    description:
      'Convert a SQL WHERE clause into JsonLogic rules you can evaluate in the browser or on the server. Handles IN, BETWEEN, LIKE and NULL checks. Free, client-side.',
    lede: 'Turn a WHERE clause into a JsonLogic rule: the same condition, as JSON you can store and evaluate anywhere.',
    label: 'SQL to JsonLogic',
    sample: `country IN ('US', 'CA', 'GB')
  AND plan <> 'free'
  AND seats >= 5
  AND company_name LIKE 'Acme%'
  AND NOT (beta_opt_out = TRUE)`,
    notes: [
      'The output follows the conventions react-querybuilder and react-awesome-query-builder use: == and != for equality, in for lists, a three-argument <= for BETWEEN, and startsWith/endsWith/in for LIKE patterns.',
      'JsonLogic compares case-sensitively and coerces null like JavaScript does, so a rule can behave differently from SQL on NULLs and collations. The qnot docs list each difference.',
    ],
    faq: [
      PRIVACY,
      {
        q: 'What are startsWith and endsWith in the output?',
        a: 'JsonLogic has no LIKE. qnot writes prefix and suffix matches as startsWith and endsWith operations, as react-querybuilder does; add them to json-logic-js with add_operation if your evaluator lacks them.',
      },
      SCHEMA,
    ],
  },
  {
    slug: 'jsonlogic-to-sql',
    from: 'jsonlogic',
    to: ['sql'],
    title: 'JsonLogic to SQL converter',
    metaTitle: 'JsonLogic to SQL Converter (Free, Online)',
    description:
      'Convert JsonLogic rules into a SQL WHERE clause for Postgres, MySQL, SQLite or SQL Server, inline or with bound parameters. Free and runs in your browser.',
    lede: 'Paste a JsonLogic rule and get the equivalent WHERE clause for your database.',
    label: 'JsonLogic to SQL',
    sample: `{
  "and": [
    { "==": [{ "var": "status" }, "active"] },
    { "<=": [18, { "var": "age" }, 65] },
    { "or": [
      { "in": [{ "var": "plan" }, ["pro", "team"]] },
      { "in": ["@acme.com", { "var": "email" }] }
    ] },
    { "!": { "var": "suspended" } }
  ]
}`,
    notes: [
      'Each JsonLogic operation becomes a qnot rule: == and != are equality, <, <=, >, >= comparisons, a three-argument <= is BETWEEN, in over a list is IN and in over a string is a contains (LIKE with escaped wildcards).',
      '! and !! read as "is empty" and "is not empty", which SQL writes as a NULL-or-empty check. Lists tested with some, all and none become array conditions.',
    ],
    faq: [
      PRIVACY,
      {
        q: 'Which JsonLogic operations are supported?',
        a: 'and, or, !, !!, ==, ===, !=, !==, <, <=, >, >=, in, some, all, none, startsWith, endsWith and var. Arithmetic, map/reduce over values, if and custom operations have no WHERE equivalent and are reported as errors.',
      },
      SCHEMA,
    ],
  },
  {
    slug: 'jsonlogic-to-mongodb',
    from: 'jsonlogic',
    to: ['mongo'],
    title: 'JsonLogic to MongoDB converter',
    metaTitle: 'JsonLogic to MongoDB Query Converter (Free, Online)',
    description:
      'Convert JsonLogic rules into a MongoDB filter: comparisons, in, some/all/none and and/or become $gte, $in, $elemMatch and $or. Free, runs in your browser.',
    lede: 'Paste a JsonLogic rule and get a MongoDB filter that matches the same documents.',
    label: 'JsonLogic to MongoDB',
    sample: `{
  "and": [
    { "in": [{ "var": "category" }, ["shoes", "boots"]] },
    { "<": [{ "var": "price" }, 120] },
    { "==": [{ "var": "in_stock" }, true] },
    { "some": [{ "var": "reviews" }, { ">=": [{ "var": "rating" }, 4] }] }
  ]
}`,
    notes: [
      'Comparisons map to $eq, $lt, $gte and friends, in over a list to $in, and and/or to $and/$or.',
      "some, all and none over a list of objects become $elemMatch, $not $elemMatch and the double negation qnot uses for all, because JsonLogic's all is false for an empty list while Mongo's is true.",
    ],
    faq: [
      PRIVACY,
      {
        q: 'How are lists handled?',
        a: 'some over a list of records becomes $elemMatch. some over a list of plain values (tags, roles) becomes $in on that field, and an and of in checks becomes $all.',
      },
      SCHEMA,
    ],
  },
  {
    slug: 'sql-to-elasticsearch',
    from: 'sql',
    to: ['elasticsearch'],
    title: 'SQL to Elasticsearch converter',
    metaTitle: 'SQL to Elasticsearch Query DSL Converter (Free)',
    description:
      'Convert a SQL WHERE clause into an Elasticsearch bool query: term, terms, range, wildcard and exists clauses in must, should and must_not. Free, in-browser.',
    lede: 'Paste a WHERE clause and get the Elasticsearch query DSL: a bool query you can drop into _search.',
    label: 'SQL to Elasticsearch',
    sample: `category IN ('shoes', 'boots')
  AND price BETWEEN 50 AND 200
  AND in_stock = TRUE
  AND name LIKE '%trail%'
  AND NOT brand = 'Acme'`,
    notes: [
      'AND becomes bool.must, OR becomes bool.should with minimum_should_match: 1, and NOT becomes must_not. Equality is a term query, IN a terms query, comparisons and BETWEEN a range query, IS NULL a must_not exists.',
      'LIKE patterns become case-insensitive wildcard queries with the pattern escaped. Map text fields you filter on as keyword, or declare them caseSensitive in your schema.',
    ],
    faq: [
      PRIVACY,
      {
        q: 'Does it use the Elasticsearch SQL API?',
        a: 'No. It writes the query DSL directly, so the output works on any cluster and in OpenSearch, without the SQL plugin. Paste the result under "query" in a _search request.',
      },
      SCHEMA,
    ],
  },
  {
    slug: 'react-querybuilder-to-sql',
    from: 'rqb',
    to: ['sql', 'mongo', 'jsonlogic'],
    title: 'react-querybuilder to SQL converter',
    metaTitle: 'react-querybuilder JSON to SQL, MongoDB and JsonLogic',
    description:
      'Convert react-querybuilder JSON into SQL, a MongoDB filter or JsonLogic. Paste a saved query, pick a dialect, copy the result. Free and runs in your browser.',
    lede: "Paste a react-querybuilder query (RuleGroupType JSON) and export it to SQL, MongoDB or JsonLogic with qnot's codecs.",
    label: 'react-querybuilder to SQL',
    sample: `{
  "combinator": "and",
  "rules": [
    { "field": "firstName", "operator": "beginsWith", "value": "Stev" },
    { "field": "lastName", "operator": "in", "value": "Vai,Vaughan" },
    { "field": "age", "operator": ">", "value": "28" },
    {
      "combinator": "or",
      "rules": [
        { "field": "isMusician", "operator": "=", "value": true },
        { "field": "instrument", "operator": "=", "value": "Guitar" }
      ]
    }
  ]
}`,
    notes: [
      "The rqb codec reads react-querybuilder's RuleGroupType, including comma-separated list values, the doesNotBeginWith family and independent combinators. Disabled rules are dropped.",
      'react-querybuilder stores many values as strings. The inferred schema treats a field as a number when the query compares it as one, so "28" in age > "28" is written as 28.',
      'The same JSON works as a store format in qnot: give createQueryStore format: rqb and your saved queries load as they are.',
    ],
    faq: [
      PRIVACY,
      {
        q: 'Can I keep my saved react-querybuilder queries if I switch?',
        a: "Yes. qnot's rqb format reads and writes react-querybuilder's JSON, so a store can take your saved queries as its value and hand back the same shape on change.",
      },
      SCHEMA,
    ],
  },
  {
    slug: 'raqb-to-sql',
    from: 'raqb',
    to: ['sql', 'mongo', 'jsonlogic'],
    title: 'RAQB tree to SQL converter',
    metaTitle: 'RAQB Tree to SQL, MongoDB and JsonLogic Converter',
    description:
      'Convert a react-awesome-query-builder (RAQB) JSON tree into SQL, a MongoDB filter or JsonLogic without its config. Free, client-side, nothing is uploaded.',
    lede: 'Paste a react-awesome-query-builder tree (Utils.getTree output) and export it to SQL, MongoDB or JsonLogic, no RAQB config needed.',
    label: 'RAQB to SQL',
    sample: `{
  "id": "9a99988a-0123-4456-b89a-b1607f326fd8",
  "type": "group",
  "properties": { "conjunction": "AND", "not": false },
  "children1": [
    { "id": "a98ab9b9-cdef-4012-b456-71607f326fd9", "type": "rule",
      "properties": { "field": "status", "operator": "select_any_in",
        "value": [["open", "pending"]], "valueSrc": ["value"], "valueType": ["multiselect"] } },
    { "id": "b8a8a9a8-89ab-4cde-b012-31607f326fda", "type": "rule",
      "properties": { "field": "priority", "operator": "greater_or_equal",
        "value": [2], "valueSrc": ["value"], "valueType": ["number"] } },
    { "id": "aaab8999-4567-489a-bcde-f1607f326fdb", "type": "group",
      "properties": { "conjunction": "OR", "not": false },
      "children1": [
        { "id": "99b8a9ab-0123-4456-b89a-b1607f326fdc", "type": "rule",
          "properties": { "field": "title", "operator": "like",
            "value": ["outage"], "valueSrc": ["value"], "valueType": ["text"] } },
        { "id": "8b8aab9a-cdef-4012-b456-71607f326fdd", "type": "rule",
          "properties": { "field": "created", "operator": "between",
            "value": ["2026-09-01", "2026-09-30"], "valueSrc": ["value", "value"], "valueType": ["date", "date"] } }
      ] },
    { "id": "ab99a8b8-89ab-4cde-b012-31607f326fde", "type": "rule",
      "properties": { "field": "assignee", "operator": "is_null",
        "value": [], "valueSrc": [], "valueType": [] } }
  ]
}`,
    notes: [
      "RAQB's own exporters need its config to run. The raqb codec reads the tree directly: groups and their conjunctions, NOT, rule_group array conditions (some, all, none and counts), multiselect operators, BasicFuncs such as LOWER and NOW, and locked rules.",
      "Children may be an array or RAQB's id map. Field names and value types come from the tree; the inferred schema fills in the rest.",
    ],
    faq: [
      PRIVACY,
      {
        q: 'Do I need my RAQB config?',
        a: "No. The converter infers a schema from the tree. In an app you'd declare the fields with defineFields, which also gives you typed queries, and use the same raqb format to read and write RAQB trees.",
      },
      {
        q: 'What about array (rule_group) conditions?',
        a: 'They convert to $elemMatch in MongoDB and some/all/none in JsonLogic. SQL can express them on Postgres with a jsonb column; other dialects report the rule instead of dropping it.',
      },
    ],
  },
];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
