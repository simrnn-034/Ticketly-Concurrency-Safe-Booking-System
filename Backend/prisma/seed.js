import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prisma from '../config/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, 'seed.json'), 'utf-8'));

async function seed() {
  console.log('🌱 Starting seed...\n');

  // ── clean existing data in correct order
  console.log('🧹 Cleaning existing data...');
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.seatCategory.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Cleaned\n');

  // ── seed users
  console.log('👤 Seeding users...');
  const createdUsers = {};

  for (const user of data.users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const created = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: hashedPassword,
        role: user.role,
        phone: user.phone
      }
    });
    createdUsers[user.role === 'organizer' ? 'organizer' : user.email] = created;
    console.log(`   ✓ ${user.role} — ${user.email}`);
  }
  console.log();

  // ── seed events
  console.log('🎭 Seeding events...');
  const organizer = createdUsers['organizer'];

  for (const eventData of data.events) {
    const { categories, date_time, status, ...eventFields } = eventData;

    // calculate total seats
    const totalSeats = categories.reduce((sum, cat) => {
      return sum + (cat.rows.length * cat.seats_per_row);
    }, 0);

    const event = await prisma.$transaction(async (trx) => {
      // create event
      const newEvent = await trx.event.create({
        data: {
          ...eventFields,
          eventDate: new Date(date_time),
          totalSeats,
          organizerId: organizer.id,
          status
        }
      });

      // create seat categories and seats
      for (const cat of categories) {
        const seatCategory = await trx.seatCategory.create({
          data: {
            categoryName: cat.name,
            price: cat.price,
            eventId: newEvent.id,
            totalSeats: cat.rows.length * cat.seats_per_row
          }
        });

        const seatValues = cat.rows.flatMap(row =>
          Array.from({ length: cat.seats_per_row }, (_, i) => ({
            eventId: newEvent.id,
            categoryId: seatCategory.id,
            rowLabel: row,
            seatNumber: i + 1,
            status: 'available'
          }))
        );

        await trx.seat.createMany({ data: seatValues });
      }

      return newEvent;
    });

    console.log(`   ✓ [${status.toUpperCase()}] ${event.title} — ${totalSeats} seats`);
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('─'.repeat(50));
  console.log('Test accounts:');
  console.log('  Organizer  →  organizer@test.com  /  password123');
  console.log('  User       →  user@test.com       /  password123');
  console.log('  User       →  rohan@test.com      /  password123');
  console.log('─'.repeat(50));
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });