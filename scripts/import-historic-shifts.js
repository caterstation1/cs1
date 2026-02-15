/* eslint-disable no-console */
// One-off importer for historic staffing hours CSV
// Expected headers: Email, Start Date, In, End Date, Out, Shift hours, Daily total hours
// NZ-local parsing, creates completed Shift rows

const fs = require('fs');
const path = require('path');
// Use project-local generated client (prisma generate outputs to src/generated/prisma)
const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { file: '', commit: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file' || a === '-f') {
      out.file = args[++i];
    } else if (a === '--commit') {
      out.commit = true;
    } else if (a === '--dry' || a === '--dry-run') {
      out.commit = false;
    }
  }
  return out;
}

// Minimal CSV parser with quotes support
function parseCsv(content) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < content.length) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim()); field = '';
      } else if (ch === '\n') {
        row.push(field.trim()); field = '';
        if (row.length && !(row.length === 1 && row[0] === '')) rows.push(row);
        row = [];
      } else if (ch === '\r') {
        // ignore
      } else {
        field += ch;
      }
    }
    i++;
  }
  if (field.length || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

function pickHeaderIndex(headers, name) {
  const idx = headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
  if (idx === -1) throw new Error(`Missing required header: ${name}`);
  return idx;
}

function parseNZDateString(s) {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0, 0);
}

function parseHHMM(s) {
  if (!s) return null;
  const m = s.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
  if (!m) return null;
  const hh = Number(m[1]); const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return { hh, mm };
}

function parseDecimalHours(s) {
  if (!s) return null;
  const n = Number(String(s).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return n;
}

function addHours(date, hours) {
  return new Date(date.getTime() + Math.round(hours * 60) * 60 * 1000);
}

async function main() {
  const { file, commit } = parseArgs();
  const filePath = file
    ? path.resolve(file)
    : path.resolve('Connecteamhistorichours - Sheet1.csv');
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found at ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(content);
  if (rows.length < 2) {
    throw new Error('CSV appears to be empty');
  }
  const headers = rows[0];
  const iEmail = pickHeaderIndex(headers, 'Email');
  const iStart = pickHeaderIndex(headers, 'Start Date');
  const iIn = pickHeaderIndex(headers, 'In');
  const iEnd = pickHeaderIndex(headers, 'End Date');
  const iOut = pickHeaderIndex(headers, 'Out');
  const iShift = pickHeaderIndex(headers, 'Shift hours');
  const iDaily = pickHeaderIndex(headers, 'Daily total hours');

  let created = 0;
  const unknownEmails = new Map(); // email -> count
  const operations = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const email = (row[iEmail] || '').trim().toLowerCase();
    if (!email) continue;
    const startDate = parseNZDateString(row[iStart]);
    const endDate = parseNZDateString(row[iEnd]) || startDate;
    const inTime = parseHHMM(row[iIn]);
    const outTime = parseHHMM(row[iOut]);
    const dailyHours = parseDecimalHours(row[iDaily]);
    const shiftHours = parseDecimalHours(row[iShift]);

    let hours = null;
    if (inTime && outTime) {
      const clockIn = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), inTime.hh, inTime.mm, 0, 0);
      const outBase = endDate || startDate;
      const clockOut = new Date(outBase.getFullYear(), outBase.getMonth(), outBase.getDate(), outTime.hh, outTime.mm, 0, 0);
      const diff = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      hours = diff > 0 ? diff : null;
    }
    if (hours == null) {
      hours = (dailyHours != null ? dailyHours : shiftHours != null ? shiftHours : null);
    }
    if (hours == null || !Number.isFinite(hours) || hours <= 0) continue;

    const clockIn = (() => {
      if (inTime) return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), inTime.hh, inTime.mm, 0, 0);
      // default 09:00
      return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 9, 0, 0, 0);
    })();
    const clockOut = (() => {
      if (outTime) return new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), outTime.hh, outTime.mm, 0, 0);
      return addHours(clockIn, hours);
    })();
    const dateMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);

    operations.push({ email, dateMidnight, clockIn, clockOut, hours: Number(hours.toFixed(2)) });
  }

  // Prefetch staff emails
  const emails = Array.from(new Set(operations.map(o => o.email)));
  const staffList = await prisma.staff.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true }
  });
  const emailToStaffId = new Map(staffList.map(s => [s.email.toLowerCase(), s.id]));

  for (const op of operations) {
    const staffId = emailToStaffId.get(op.email);
    if (!staffId) {
      unknownEmails.set(op.email, (unknownEmails.get(op.email) || 0) + 1);
      continue;
    }
    if (!commit) continue;
    await prisma.shift.create({
      data: {
        staffId,
        clockIn: op.clockIn,
        clockOut: op.clockOut,
        totalHours: op.hours,
        date: op.dateMidnight,
        status: 'completed',
        notes: 'Historic import'
      }
    });
    created++;
  }

  console.log(`Parsed rows: ${rows.length - 1}`);
  console.log(`Prepared operations: ${operations.length}`);
  console.log(`Unique emails in file: ${emails.length}`);
  console.log(`Known staff found: ${emailToStaffId.size}`);
  if (unknownEmails.size) {
    console.log('Unknown emails (count of rows):');
    for (const [em, cnt] of unknownEmails.entries()) {
      console.log(`  - ${em}: ${cnt}`);
    }
  } else {
    console.log('No unknown emails.');
  }
  if (commit) {
    console.log(`Created shifts: ${created}`);
  } else {
    console.log('Dry run only. Re-run with --commit to insert.');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error(err);
    prisma.$disconnect().then(() => process.exit(1));
  });

