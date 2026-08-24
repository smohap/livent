/**
 * Event templates (PRD section 35). A template seeds phases, teams and budget
 * categories so a new organiser starts from a shaped event rather than a blank
 * page. Everything a template creates is fully editable afterwards.
 */

export interface PhaseTemplate {
  name: string;
  requiresSeating?: boolean;
  requiresMenu?: boolean;
  requiresTicket?: boolean;
  dayOffset?: number;
}

export interface EventTemplate {
  key: string;
  label: string;
  category: 'individual' | 'corporate' | 'community';
  blurb: string;
  phases: PhaseTemplate[];
  teams: string[];
  budgetCategories: string[];
}

export const TEMPLATES: EventTemplate[] = [
  {
    key: 'wedding',
    label: 'Wedding',
    category: 'individual',
    blurb: 'A multi-day celebration with its own guest list, menu and seating per phase.',
    phases: [
      { name: 'Engagement', dayOffset: -34 },
      { name: 'Mehendi', dayOffset: -2 },
      { name: 'Sangeet', requiresSeating: true, requiresMenu: true, dayOffset: -1 },
      { name: 'Ceremony', requiresSeating: true, dayOffset: 0 },
      { name: 'Reception', requiresSeating: true, requiresMenu: true, dayOffset: 0 },
      { name: 'Post Wedding', dayOffset: 1 },
    ],
    teams: ['Catering', 'Decoration', 'Photography', 'Transport', 'Entertainment', 'Hospitality'],
    budgetCategories: [
      'Venue',
      'Catering',
      'Decoration',
      'Photography',
      'Entertainment',
      'Transport',
      'Invitations',
      'Accommodation',
      'Gifts',
      'Miscellaneous',
    ],
  },
  {
    key: 'conference',
    label: 'Annual Conference',
    category: 'corporate',
    blurb: 'Registration through awards, with ticketing and speaker logistics built in.',
    phases: [
      { name: 'Registration', requiresTicket: true, dayOffset: 0 },
      { name: 'Welcome Reception', requiresMenu: true, dayOffset: 0 },
      { name: 'Keynote', requiresTicket: true, dayOffset: 1 },
      { name: 'Breakout Sessions', dayOffset: 1 },
      { name: 'Networking', dayOffset: 1 },
      { name: 'Gala Dinner', requiresSeating: true, requiresMenu: true, dayOffset: 1 },
      { name: 'Awards', requiresSeating: true, dayOffset: 1 },
    ],
    teams: ['Registration', 'AV & Technology', 'Catering', 'Marketing', 'Sponsorship', 'Venue'],
    budgetCategories: [
      'Venue',
      'Catering',
      'Technology',
      'Marketing',
      'Speakers',
      'Production',
      'Security',
      'Miscellaneous',
    ],
  },
  {
    key: 'birthday',
    label: 'Birthday',
    category: 'individual',
    blurb: 'A single-day celebration with a light schedule and simple RSVP.',
    phases: [
      { name: 'Welcome', dayOffset: 0 },
      { name: 'Activities', dayOffset: 0 },
      { name: 'Cake', dayOffset: 0 },
      { name: 'Dinner', requiresSeating: true, requiresMenu: true, dayOffset: 0 },
      { name: 'Entertainment', dayOffset: 0 },
    ],
    teams: ['Catering', 'Decoration', 'Entertainment'],
    budgetCategories: ['Venue', 'Catering', 'Decoration', 'Entertainment', 'Gifts'],
  },
  {
    key: 'offsite',
    label: 'Corporate Offsite',
    category: 'corporate',
    blurb: 'Arrival to departure, with travel, workshops and an awards dinner.',
    phases: [
      { name: 'Arrival', dayOffset: 0 },
      { name: 'Team Activities', dayOffset: 0 },
      { name: 'Workshops', dayOffset: 1 },
      { name: 'Dinner', requiresSeating: true, requiresMenu: true, dayOffset: 1 },
      { name: 'Awards', dayOffset: 1 },
      { name: 'Departure', dayOffset: 2 },
    ],
    teams: ['Logistics', 'Facilitation', 'Catering', 'Transport'],
    budgetCategories: ['Venue', 'Accommodation', 'Catering', 'Transport', 'Facilitation', 'Gifts'],
  },
  {
    key: 'fundraiser',
    label: 'Fundraiser',
    category: 'community',
    blurb: 'Ticketed community event with sponsorship, donations and a seated dinner.',
    phases: [
      { name: 'Doors & Registration', requiresTicket: true, dayOffset: 0 },
      { name: 'Welcome Drinks', dayOffset: 0 },
      { name: 'Dinner & Auction', requiresSeating: true, requiresMenu: true, dayOffset: 0 },
      { name: 'Closing', dayOffset: 0 },
    ],
    teams: ['Fundraising', 'Catering', 'Volunteers', 'Marketing'],
    budgetCategories: ['Venue', 'Catering', 'Marketing', 'Auction', 'Volunteers'],
  },
  {
    key: 'custom',
    label: 'Start from scratch',
    category: 'individual',
    blurb: 'One empty phase. Add whatever the event actually needs.',
    phases: [{ name: 'Main Event', dayOffset: 0 }],
    teams: [],
    budgetCategories: ['Venue', 'Catering', 'Miscellaneous'],
  },
];

export function findTemplate(key: string): EventTemplate {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[TEMPLATES.length - 1]!;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
