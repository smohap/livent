/**
 * Seeds the demo event from the Evyent mockup: a five-phase Indian wedding
 * with a real guest list, RSVP spread, menu, tables, tasks, budget and media.
 *
 * Safe to re-run: it wipes and rebuilds the demo event only.
 */
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Prisma 7 connects through a driver adapter rather than a native engine.
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL ?? ''),
});

const DEMO_SLUG = 'sarah-and-john';

const FIRST_NAMES = [
  'Priya', 'Michael', 'Anjali', 'David', 'Emma', 'Rohan', 'Grace', 'Samuel', 'Aroha', 'Wei',
  'Fatima', 'James', 'Leilani', 'Arjun', 'Sophie', 'Tane', 'Mei', 'Daniel', 'Ngaire', 'Omar',
  'Chloe', 'Vikram', 'Hannah', 'Kiri', 'Yusuf', 'Isabella', 'Raj', 'Olivia', 'Hemi', 'Noor',
];
const LAST_NAMES = [
  'Nair', 'Chen', 'Mehta', 'Osei', 'Wilson', 'Patel', 'Ngata', 'Kaur', 'Brown', 'Ali',
  'Singh', 'Tupou', 'Kumar', 'Taylor', 'Hussain', 'Williams', 'Rangi', 'Iyer', 'Clark', 'Zhao',
];

/** Deterministic PRNG so a re-seed produces the same demo event. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261212);
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)]!;
const day = (base: Date, offset: number) => new Date(base.getTime() + offset * 86_400_000);

/**
 * The seed deletes and recreates the demo event and creates accounts with a
 * known password. That is fine locally and dangerous anywhere else, so a
 * non-local DATABASE_URL requires an explicit SEED_CONFIRM=yes.
 */
function assertSafeTarget(): void {
  const url = process.env.DATABASE_URL ?? '';
  const isLocal =
    url.startsWith('file:') || url.includes('@localhost') || url.includes('@127.0.0.1');

  if (isLocal || process.env.SEED_CONFIRM === 'yes') return;

  const host = url.replace(/^\w+:\/\/[^@]*@/, '').split('/')[0] ?? 'unknown host';
  throw new Error(
    [
      `Refusing to seed a non-local database (${host}).`,
      'This wipes the demo event and creates accounts with a known password.',
      'Re-run with SEED_CONFIRM=yes if that is genuinely what you want.',
    ].join(' '),
  );
}

async function main() {
  assertSafeTarget();
  console.log('Seeding Evyent demo data...');

  const existing = await prisma.event.findUnique({ where: { slug: DEMO_SLUG } });
  if (existing) {
    await prisma.event.delete({ where: { id: existing.id } });
    console.log('  removed previous demo event');
  }

  const passwordHash = await bcrypt.hash('evyent2026', 12);

  const [organiser, manager, finance, catering] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'sarah@evyent.com' },
      update: {},
      create: { email: 'sarah@evyent.com', name: 'Sarah Whitfield', passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'manager@evyent.com' },
      update: {},
      create: { email: 'manager@evyent.com', name: 'Ravi Deshmukh', passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'finance@evyent.com' },
      update: {},
      create: { email: 'finance@evyent.com', name: 'Tui Harrison', passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'catering@evyent.com' },
      update: {},
      create: { email: 'catering@evyent.com', name: 'Marco Bellini', passwordHash },
    }),
  ]);

  const weddingDay = new Date('2026-12-12T00:00:00.000Z');

  const event = await prisma.event.create({
    data: {
      slug: DEMO_SLUG,
      name: "Sarah & John's Wedding",
      type: 'wedding',
      category: 'individual',
      hostNames: 'Sarah Whitfield & John Anand',
      description:
        'Five celebrations, one story. Join us across the engagement, mehendi, sangeet, ceremony and reception.',
      location: 'Auckland, New Zealand',
      timezone: 'Pacific/Auckland',
      currency: 'NZD',
      privacy: 'unlisted',
      startDate: day(weddingDay, -34),
      endDate: day(weddingDay, 1),
      totalBudget: 182_000,
      ownerId: organiser.id,
    },
  });

  await prisma.membership.createMany({
    data: [
      { userId: manager.id, eventId: event.id, role: 'manager' },
      { userId: finance.id, eventId: event.id, role: 'finance' },
    ],
  });

  const phaseSpec = [
    { name: 'Engagement', offset: -34, venue: 'The Whitfield Home', seating: false, menu: false },
    { name: 'Mehendi', offset: -2, venue: 'Garden Venue, Parnell', seating: false, menu: false },
    { name: 'Sangeet', offset: -1, venue: 'Grand Hall, Ellerslie', seating: true, menu: true },
    { name: 'Ceremony', offset: 0, venue: 'Shri Temple, Papatoetoe', seating: true, menu: false },
    { name: 'Reception', offset: 0, venue: 'Riverside Hotel, Viaduct', seating: true, menu: true },
  ];

  const phases = [];
  for (const [index, spec] of phaseSpec.entries()) {
    phases.push(
      await prisma.phase.create({
        data: {
          eventId: event.id,
          name: spec.name,
          position: index,
          date: day(weddingDay, spec.offset),
          startTime: spec.seating ? '18:00' : '11:00',
          endTime: spec.seating ? '23:30' : '15:00',
          venue: spec.venue,
          address: `${spec.venue}, Auckland`,
          dressCode: spec.name === 'Reception' ? 'Black tie' : 'Traditional',
          requiresSeating: spec.seating,
          requiresMenu: spec.menu,
          requiresTicket: spec.name === 'Reception',
          capacity: spec.name === 'Reception' ? 820 : 400,
          description: `${spec.name} at ${spec.venue}.`,
        },
      }),
    );
  }

  console.log(`  created event with ${phases.length} phases`);
  await seedPeople(event.id, phases);
  await seedWork(event.id, phases, manager.id, catering.id);
  await seedExperience(event.id, phases, organiser.id);
  console.log('Done. Sign in as sarah@evyent.com / evyent2026');
}

type PhaseRow = { id: string; name: string; requiresSeating: boolean; requiresMenu: boolean };

async function seedPeople(eventId: string, phases: PhaseRow[]) {
  const groupNames = [
    "Bride's family",
    "Groom's family",
    'Friends',
    'Work colleagues',
    'VIP',
    'Neighbours',
  ];
  const groups = [];
  for (const name of groupNames) {
    groups.push(await prisma.guestGroup.create({ data: { eventId, name } }));
  }

  // A named cast first, so the demo tables read like a real guest list.
  const cast = [
    { name: 'Priya Nair', group: "Bride's family", vip: true, dietary: 'vegetarian' },
    { name: 'Michael Chen', group: "Groom's colleagues", vip: false, dietary: '' },
    { name: 'Anjali Mehta', group: 'Friends', vip: false, dietary: 'vegan' },
    { name: 'Rohan Mehta', group: 'Friends', vip: false, dietary: '' },
    { name: 'David Osei', group: 'Work colleagues', vip: false, dietary: 'gluten-free' },
    { name: 'Grace Wilson', group: 'VIP', vip: true, dietary: '' },
    { name: 'Samuel Wilson', group: 'VIP', vip: true, dietary: '' },
  ];

  const guestRows: Array<{ id: string; isChild: boolean }> = [];

  for (const person of cast) {
    const group = groups.find((g) => g.name === person.group) ?? groups[2]!;
    const guest = await prisma.guest.create({
      data: {
        eventId,
        groupId: group.id,
        name: person.name,
        email: `${person.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
        isVip: person.vip,
        dietary: person.dietary,
        plusOnes: rand() > 0.6 ? 1 : 0,
      },
    });
    guestRows.push({ id: guest.id, isChild: false });
  }

  // Then a realistic bulk list so counts and seating have something to chew on.
  for (let i = 0; i < 213; i++) {
    const isChild = rand() < 0.12;
    const group = pick(groups);
    const guest = await prisma.guest.create({
      data: {
        eventId,
        groupId: group.id,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        email: `guest${i}@example.com`,
        phone: `+64 21 ${String(100000 + Math.floor(rand() * 899999))}`,
        isVip: group.name === 'VIP',
        isChild,
        plusOnes: isChild ? 0 : rand() > 0.75 ? 1 : 0,
        dietary: rand() < 0.3 ? 'vegetarian' : rand() < 0.36 ? 'vegan' : '',
        allergies: rand() < 0.06 ? 'nuts' : '',
      },
    });
    guestRows.push({ id: guest.id, isChild });
  }

  // RSVP spread per phase, loosely matching the mockup's response rates.
  const rates: Record<string, number> = {
    Engagement: 0.96,
    Mehendi: 0.88,
    Sangeet: 0.84,
    Ceremony: 0.91,
    Reception: 0.79,
  };

  for (const phase of phases) {
    const responseRate = rates[phase.name] ?? 0.85;
    for (const guest of guestRows) {
      // Not everyone is invited to every phase - that is the point of phases.
      if (phase.name === 'Engagement' && rand() > 0.55) continue;
      if (phase.name === 'Mehendi' && rand() > 0.7) continue;

      const roll = rand();
      const status =
        roll > responseRate
          ? rand() > 0.5
            ? 'invited'
            : 'viewed'
          : roll < responseRate * 0.86
            ? 'attending'
            : roll < responseRate * 0.94
              ? 'maybe'
              : 'declined';

      const responded = ['attending', 'declined', 'maybe'].includes(status);
      await prisma.phaseInvite.create({
        data: {
          guestId: guest.id,
          phaseId: phase.id,
          status,
          adults: guest.isChild ? 0 : 1,
          children: guest.isChild ? 1 : 0,
          partySize: 1,
          transportNeeded: rand() < 0.18,
          accommodationNeeded: rand() < 0.1,
          respondedAt: responded ? new Date() : null,
        },
      });
    }
  }

  console.log(`  created ${guestRows.length} guests with per-phase RSVPs`);
}

async function seedWork(eventId: string, phases: PhaseRow[], managerId: string, catererId: string) {
  const teamNames = [
    'Catering',
    'Decoration',
    'Photography',
    'Transport',
    'Entertainment',
    'Hospitality',
    'Stationery',
    'Venue',
  ];
  const teams = [];
  for (const name of teamNames) {
    teams.push(await prisma.team.create({ data: { eventId, name } }));
  }
  const team = (name: string) => teams.find((t) => t.name === name)!;

  await prisma.membership.create({
    data: { userId: catererId, eventId, role: 'team_lead', teamId: team('Catering').id },
  });

  const today = new Date();
  const taskSpec = [
    ['Book venue & sign contract', 'Venue', 'completed', -60],
    ['Send save-the-dates', 'Stationery', 'completed', -45],
    ['Finalise catering headcount', 'Catering', 'in_progress', 4],
    ['Confirm shuttle bus timetable', 'Transport', 'in_progress', 8],
    ['Build ceremony photo shot list', 'Photography', 'in_progress', 10],
    ['Confirm florist final order', 'Decoration', 'not_started', 9],
    ['Print table place cards', 'Stationery', 'not_started', 12],
    ['Confirm DJ set times', 'Entertainment', 'not_started', 14],
    ['Chase outstanding RSVPs', 'Hospitality', 'in_progress', -2],
    ['Approve final catering invoice', 'Catering', 'awaiting_approval', -1],
  ] as const;

  let headcountTaskId: string | null = null;
  for (const [title, teamName, status, dueOffset] of taskSpec) {
    const task = await prisma.task.create({
      data: {
        eventId,
        title,
        teamId: team(teamName).id,
        status,
        priority: dueOffset < 0 && status !== 'completed' ? 'critical' : 'medium',
        dueDate: day(today, dueOffset),
        ownerId: managerId,
        phaseId: phases[4]!.id,
        dependsOnId: title.startsWith('Approve final catering') ? headcountTaskId : null,
      },
    });
    if (title === 'Finalise catering headcount') headcountTaskId = task.id;
  }

  // Budget lines mirroring the mockup's category split.
  const budgetSpec: Array<[string, number, number]> = [
    ['Venue', 46_000, 46_000],
    ['Catering', 25_000, 29_500],
    ['Decoration', 18_000, 16_400],
    ['Photography', 14_000, 14_000],
    ['Entertainment', 12_000, 10_800],
    ['Transport', 9_000, 8_200],
    ['Invitations', 6_000, 5_400],
    ['Accommodation', 22_000, 18_000],
    ['Gifts', 8_000, 3_200],
    ['Miscellaneous', 22_000, 4_100],
  ];
  const lines = [];
  for (const [category, budgeted, committed] of budgetSpec) {
    lines.push(
      await prisma.budgetLine.create({ data: { eventId, category, budgeted, committed } }),
    );
  }

  const vendorSpec: Array<[string, string, string]> = [
    ['Spice Route Catering', 'caterer', 'Catering'],
    ['Aperture Studio', 'photographer', 'Photography'],
    ['Bloom & Bough', 'florist', 'Decoration'],
    ['Northside Coaches', 'transport', 'Transport'],
    ['DJ Kaea', 'dj', 'Entertainment'],
    ['Riverside Hotel', 'venue', 'Venue'],
    ['Harbour Lodge', 'accommodation', 'Accommodation'],
    ['Paperbark Press', 'printing', 'Invitations'],
  ];

  const vendors = new Map<string, string>();
  for (const [name, type, categoryName] of vendorSpec) {
    const vendor = await prisma.vendor.create({ data: { eventId, name, type } });
    vendors.set(categoryName, vendor.id);
  }

  // One approved invoice per category, summing exactly to that category's
  // committed figure. `committed` is derived from approved invoices everywhere
  // in the app, so the seeded totals and the finance module always agree.
  let invoiceNo = 101;
  for (const line of lines) {
    if (line.committed <= 0) continue;

    const amount = Math.round((line.committed / 1.15) * 100) / 100;
    const tax = Math.round((line.committed - amount) * 100) / 100;
    const paidInFull = rand() > 0.55;

    await prisma.invoice.create({
      data: {
        eventId,
        vendorId: vendors.get(line.category) ?? null,
        teamId: teams.find((t) => t.name === line.category)?.id ?? null,
        budgetLineId: line.id,
        phaseId: phases[4]!.id,
        number: `INV-${invoiceNo++}`,
        description: `${line.category} - contracted works`,
        amount,
        tax,
        dueDate: day(today, Math.floor(rand() * 24) - 6),
        approval: 'finance_approved',
        payment: paidInFull ? 'paid' : 'unpaid',
        paidAmount: paidInFull ? line.committed : 0,
      },
    });
  }

  console.log(`  created ${teams.length} teams, ${taskSpec.length} tasks, ${lines.length} budget lines`);
}

async function seedExperience(eventId: string, phases: PhaseRow[], authorId: string) {
  const reception = phases.find((p) => p.name === 'Reception')!;
  const sangeet = phases.find((p) => p.name === 'Sangeet')!;

  // --- Menu, on both phases that need one -------------------------------
  const menuSpec: Array<[string, Array<[string, string, string]>]> = [
    ['Welcome Drinks', [['Mango Lassi', 'vegetarian', ''], ['Citrus Mocktail', 'vegan', '']]],
    [
      'Starter',
      [
        ['Paneer Tikka', 'vegetarian', 'dairy'],
        ['Chicken Skewers', '', 'gluten'],
        ['Beetroot Chaat', 'vegan,gluten-free', ''],
      ],
    ],
    [
      'Main',
      [
        ['Vegetable Biryani', 'vegetarian', ''],
        ['Lamb Rogan Josh', '', ''],
        ['Jackfruit Curry', 'vegan,gluten-free', ''],
      ],
    ],
    ['Dessert', [['Gulab Jamun', 'vegetarian', 'dairy,nuts'], ['Coconut Sorbet', 'vegan', '']]],
  ];

  const menuItemIds: Record<string, string[]> = {};
  for (const phase of [sangeet, reception]) {
    menuItemIds[phase.id] = [];
    for (const [position, [courseName, items]] of menuSpec.entries()) {
      const course = await prisma.menuCourse.create({
        data: { phaseId: phase.id, name: courseName, position, choose: 1 },
      });
      for (const [itemPos, [name, dietary, allergens]] of items.entries()) {
        const item = await prisma.menuItem.create({
          data: { courseId: course.id, name, dietary, allergens, position: itemPos },
        });
        menuItemIds[phase.id]!.push(item.id);
      }
    }
  }

  // Meal choices for confirmed reception guests, so caterer counts are real.
  const confirmed = await prisma.phaseInvite.findMany({
    where: { phaseId: reception.id, status: 'attending' },
    select: { guestId: true },
  });
  const courses = await prisma.menuCourse.findMany({
    where: { phaseId: reception.id },
    include: { items: true },
  });
  for (const invite of confirmed) {
    if (rand() < 0.14) continue; // some guests always forget
    for (const course of courses) {
      const item = pick(course.items);
      await prisma.menuSelection.create({
        data: { guestId: invite.guestId, itemId: item.id },
      });
    }
  }

  // --- Seating: build the reception room ---------------------------------
  for (let number = 1; number <= 64; number++) {
    await prisma.seatingTable.create({
      data: {
        phaseId: reception.id,
        number,
        capacity: 10,
        kind: number <= 2 ? 'vip' : number >= 63 ? 'children' : 'standard',
      },
    });
  }

  // --- Schedule -----------------------------------------------------------
  const runSheet: Array<[string, string, string]> = [
    ['17:00', 'Doors open', 'Hospitality'],
    ['17:30', 'Welcome drinks', 'Catering'],
    ['18:00', 'Guests seated', 'Hospitality'],
    ['18:30', 'Speeches', 'Entertainment'],
    ['19:00', 'Dinner service', 'Catering'],
    ['20:30', 'First dance', 'Entertainment'],
    ['21:00', 'Cake cutting', 'Catering'],
    ['21:30', 'Dancing', 'Entertainment'],
    ['23:30', 'Carriages', 'Transport'],
  ];
  for (const [position, [startTime, title, ownerTeam]] of runSheet.entries()) {
    await prisma.scheduleItem.create({
      data: {
        phaseId: reception.id,
        title,
        startTime,
        ownerTeam,
        position,
        location: 'Riverside Hotel, Viaduct',
      },
    });
  }

  // --- Polls, announcements, albums, gifts --------------------------------
  const poll = await prisma.poll.create({
    data: {
      eventId,
      phaseId: reception.id,
      question: 'Which first-dance song?',
      options: {
        create: [
          { label: 'Perfect - Ed Sheeran', position: 0 },
          { label: 'All of Me - John Legend', position: 1 },
          { label: 'A Thousand Years - Christina Perri', position: 2 },
        ],
      },
    },
    include: { options: true },
  });

  const voters = confirmed.slice(0, 120);
  for (const [index, voter] of voters.entries()) {
    const option = poll.options[index % 3 === 0 ? 0 : index % 3 === 1 ? 0 : rand() > 0.5 ? 1 : 2]!;
    await prisma.pollVote.create({ data: { optionId: option.id, guestId: voter.guestId } });
  }

  await prisma.announcement.createMany({
    data: [
      {
        eventId,
        authorId,
        body: 'Reception venue entrance has changed - please use Entrance B off Customs Street.',
        audience: 'all_guests',
        channels: 'in_app,email,push',
      },
      {
        eventId,
        authorId,
        body: 'Shuttle buses depart the hotel lobby from 5:30 PM.',
        audience: 'all_guests',
        channels: 'in_app',
      },
    ],
  });

  for (const phase of phases) {
    await prisma.album.create({
      data: { eventId, phaseId: phase.id, name: `${phase.name} album`, guestUploads: true },
    });
  }
  await prisma.album.create({
    data: { eventId, name: 'Guest uploads', guestUploads: true, downloads: 'guests' },
  });

  const giftGuests = confirmed.slice(0, 24);
  for (const [index, giver] of giftGuests.entries()) {
    await prisma.gift.create({
      data: {
        eventId,
        guestId: giver.guestId,
        fromName: index % 5 === 0 ? 'Anonymous' : 'A wedding guest',
        anonymous: index % 5 === 0,
        amount: [50, 100, 150, 200, 250, 500][index % 6]!,
        currency: 'NZD',
        message: 'Congratulations to you both!',
        providerRef: `pi_demo_${index}`,
      },
    });
  }

  // Reception ticketing (the premium module in the mockup).
  const general = await prisma.ticketType.create({
    data: { phaseId: reception.id, name: 'General', price: 0, capacity: 700, perks: 'Assigned table' },
  });
  await prisma.ticketType.create({
    data: { phaseId: reception.id, name: 'VIP', price: 0, capacity: 120, perks: 'Front tables, welcome gift' },
  });
  for (const invite of confirmed.slice(0, 180)) {
    await prisma.ticket.create({
      data: {
        ticketTypeId: general.id,
        guestId: invite.guestId,
        status: rand() > 0.5 ? 'checked_in' : 'issued',
        checkedInAt: rand() > 0.5 ? new Date() : null,
      },
    });
  }

  console.log('  created menu, seating, schedule, polls, media, gifts and tickets');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
