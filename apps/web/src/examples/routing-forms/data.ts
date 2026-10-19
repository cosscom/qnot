import { compile, createQueryStore, defineFields, f, type QueryOf, type QueryStore, type RowOf } from '@trawlnet/core';

/** The routing form's questions double as the query schema: each rule asks about one answer. */
export const formFields = defineFields({
  fullName: f.text({ label: 'Full name', meta: { type: 'Short text', required: true } }),
  email: f.text({ label: 'Email', pattern: /^[^@\s]+@[^@\s]+$/, meta: { type: 'Email', required: true } }),
  country: f.enum(
    [
      { value: 'US', label: 'United States' },
      { value: 'IN', label: 'India' },
      { value: 'BR', label: 'Brazil' },
      { value: 'NG', label: 'Nigeria' },
      { value: 'DE', label: 'Germany' },
      { value: 'PH', label: 'Philippines' },
      { value: 'MX', label: 'Mexico' },
    ],
    { label: 'Country of citizenship', meta: { type: 'Select' } },
  ),
  visaType: f.enum(
    [
      { value: 'h1b', label: 'H-1B specialty occupation' },
      { value: 'o1', label: 'O-1 extraordinary ability' },
      { value: 'eb2', label: 'EB-2 National Interest Waiver' },
      { value: 'l1', label: 'L-1 intracompany transfer' },
      { value: 'f1', label: 'F-1 student' },
      { value: 'family', label: 'Family-based green card' },
    ],
    { label: 'Visa type', meta: { type: 'Select' } },
  ),
  companySize: f.number({ label: 'Company size', min: 1, meta: { type: 'Number' } }),
  urgency: f.enum(
    [
      { value: 'asap', label: 'Within 2 weeks' },
      { value: 'quarter', label: 'Within 3 months' },
      { value: 'exploring', label: 'Just exploring' },
    ],
    { label: 'How soon do you need help?', meta: { type: 'Radio' } },
  ),
  budget: f.number({ label: 'Budget (USD)', min: 0, meta: { type: 'Number' } }),
  notes: f.text({ label: 'Anything else we should know?', required: false, meta: { type: 'Long text' } }),
});
export type FormFields = typeof formFields;
export type FormResponse = RowOf<FormFields>;

/** Team-member attributes for "assign to a team member based on their attributes". */
export const attributeFields = defineFields({
  location: f.enum(['US East', 'US West', 'EMEA', 'APAC', 'LATAM'], { label: 'Location' }),
  skills: f.multiEnum(['H-1B', 'O-1', 'EB-2', 'L-1', 'Student visas', 'Family', 'Litigation'], { label: 'Skills' }),
  seniority: f.enum(['Associate', 'Senior', 'Partner'], { label: 'Seniority' }),
  languages: f.multiEnum(['English', 'Spanish', 'Portuguese', 'Hindi', 'Tagalog', 'German'], { label: 'Languages' }),
  yearsExperience: f.number({ label: 'Years of experience', min: 0 }),
});
export type AttributeFields = typeof attributeFields;

/** A team member: their attributes typed by the schema, plus display data. */
export type TeamMember = { [K in keyof RowOf<AttributeFields>]-?: NonNullable<RowOf<AttributeFields>[K]> } & { id: string; name: string; avatar: string };

export const TEAM: TeamMember[] = [
  { id: 'm1', name: 'Priya Raman', avatar: 'PR', location: 'US East', skills: ['H-1B', 'EB-2', 'L-1'], seniority: 'Partner', languages: ['English', 'Hindi'], yearsExperience: 14 },
  { id: 'm2', name: 'Diego Alvarez', avatar: 'DA', location: 'LATAM', skills: ['Family', 'Student visas'], seniority: 'Associate', languages: ['English', 'Spanish', 'Portuguese'], yearsExperience: 3 },
  { id: 'm3', name: 'Hannah Becker', avatar: 'HB', location: 'EMEA', skills: ['L-1', 'O-1'], seniority: 'Senior', languages: ['English', 'German'], yearsExperience: 8 },
  { id: 'm4', name: 'Marcus Lee', avatar: 'ML', location: 'US West', skills: ['O-1', 'EB-2', 'Litigation'], seniority: 'Partner', languages: ['English'], yearsExperience: 17 },
  { id: 'm5', name: 'Grace Okafor', avatar: 'GO', location: 'EMEA', skills: ['Family', 'Student visas', 'H-1B'], seniority: 'Senior', languages: ['English'], yearsExperience: 6 },
  { id: 'm6', name: 'Paolo Santos', avatar: 'PS', location: 'APAC', skills: ['H-1B', 'Student visas'], seniority: 'Associate', languages: ['English', 'Tagalog'], yearsExperience: 2 },
  { id: 'm7', name: 'Sofia Martins', avatar: 'SM', location: 'LATAM', skills: ['O-1', 'Family'], seniority: 'Senior', languages: ['Portuguese', 'Spanish', 'English'], yearsExperience: 9 },
];

export const EVENTS = [
  { value: 'consult-30', label: 'Immigration consultation · 30m' },
  { value: 'o1-review', label: 'O-1 portfolio review · 45m' },
  { value: 'corp-intro', label: 'Corporate immigration intro · 30m' },
  { value: 'h1b-strategy', label: 'H-1B strategy call · 60m' },
  { value: 'student-qa', label: 'Student visa Q&A · 15m' },
];

export type ActionType = 'event' | 'page' | 'url';
export interface RouteAction {
  type: ActionType;
  eventId: string | null;
  content: string;
  url: string;
}

export interface Route {
  id: string;
  name: string;
  collapsed: boolean;
  store: QueryStore<FormFields>;
  action: RouteAction;
  assign: { enabled: boolean; store: QueryStore<AttributeFields> };
}

let seq = 0;
export const routeId = () => `route_${(++seq).toString(36)}`;

const emptyAction = (): RouteAction => ({ type: 'event', eventId: null, content: '', url: '' });

export function makeRoute(name: string, query?: QueryOf<FormFields>, action?: Partial<RouteAction>, assign?: QueryOf<AttributeFields>): Route {
  return {
    id: routeId(),
    name,
    collapsed: false,
    store: createQueryStore({ fields: formFields, ...(query && { initial: query }) }),
    action: { ...emptyAction(), ...action },
    assign: { enabled: !!assign, store: createQueryStore({ fields: attributeFields, ...(assign && { initial: assign }) }) },
  };
}

export const initialRoutes = (): Route[] => [
  makeRoute(
    'Extraordinary talent',
    {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'visaType', operator: 'in', value: ['o1', 'eb2'] },
        { kind: 'rule', field: 'urgency', operator: 'eq', value: 'asap' },
      ],
    },
    { type: 'event', eventId: 'o1-review' },
    {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'skills', operator: 'hasAny', value: ['O-1', 'EB-2'] },
        { kind: 'rule', field: 'seniority', operator: 'in', value: ['Senior', 'Partner'] },
      ],
    },
  ),
  makeRoute(
    'Corporate sponsors',
    {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'companySize', operator: 'gte', value: 50 },
        { kind: 'rule', field: 'visaType', operator: 'in', value: ['h1b', 'l1'] },
      ],
    },
    { type: 'event', eventId: 'corp-intro' },
  ),
  makeRoute(
    'Students',
    { kind: 'group', combinator: 'or', children: [{ kind: 'rule', field: 'visaType', operator: 'eq', value: 'f1' }] },
    { type: 'page', content: 'Thanks! Our student visa guide is on its way to your inbox, and a paralegal will follow up within two business days.' },
  ),
];

export const initialFallback = (): RouteAction => ({ type: 'event', eventId: 'consult-30', content: '', url: '' });

/** Team members whose attributes match the route's attribute rules. */
export function qualifyingMembers(query: QueryOf<AttributeFields>): TeamMember[] {
  return TEAM.filter(compile(attributeFields, query));
}

/** First route whose rules match wins; null means fall through to the fallback. */
export function routeFor(routes: Route[], response: FormResponse): Route | null {
  return routes.find((r) => compile(formFields, r.store.getQuery())(response)) ?? null;
}

export const SAMPLE_RESPONSES: FormResponse[] = [
  { fullName: 'Ana Souza', email: 'ana@nuvem.io', country: 'BR', visaType: 'o1', companySize: 12, urgency: 'asap', budget: 9000 },
  { fullName: 'Rahul Mehta', email: 'rahul@stackly.dev', country: 'IN', visaType: 'h1b', companySize: 420, urgency: 'quarter', budget: 15000 },
  { fullName: 'Chidi Okeke', email: 'chidi@uni.edu', country: 'NG', visaType: 'f1', companySize: 1, urgency: 'exploring', budget: 500 },
  { fullName: 'Lena Fischer', email: 'lena@berlin.ai', country: 'DE', visaType: 'l1', companySize: 1800, urgency: 'asap', budget: 22000 },
  { fullName: 'Miguel Torres', email: 'miguel@gmail.com', country: 'MX', visaType: 'family', companySize: 1, urgency: 'quarter', budget: 3000 },
  { fullName: 'Jasmine Cruz', email: 'jas@pixel.ph', country: 'PH', visaType: 'eb2', companySize: 40, urgency: 'asap', budget: 12000 },
  { fullName: 'Arjun Nair', email: 'arjun@quant.co', country: 'IN', visaType: 'eb2', companySize: 8, urgency: 'exploring', budget: 7000 },
  { fullName: 'Sam Patel', email: 'sam@fintech.com', country: 'US', visaType: 'h1b', companySize: 30, urgency: 'asap', budget: 8000 },
];
