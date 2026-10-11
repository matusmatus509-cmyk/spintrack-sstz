import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDate, calendarDays } from '../src/utils/calendar.ts';

test('October calendar starts on Monday and includes adjacent month days', () => {
  const days = calendarDays(new Date(2026, 9, 15));
  assert.equal(days.length, 42);
  assert.equal(calendarDate(days[0]), '2026-09-28');
  assert.equal(calendarDate(days.at(-1)), '2026-11-08');
  assert.equal(days[0].getDay(), 1);
  assert.equal(new Set(days.map(calendarDate)).size, 42);
});

test('leap-year calendar contains February 29 and crosses the month boundary correctly', () => {
  const days = calendarDays(new Date(2028, 1, 1));
  assert.ok(days.some(day => calendarDate(day) === '2028-02-29'));
  assert.equal(calendarDate(days[0]), '2028-01-31');
  assert.equal(calendarDate(days.at(-1)), '2028-03-12');
});

test('calendar spans a year boundary with consistent local date keys', () => {
  const days = calendarDays(new Date(2026, 0, 1));
  assert.equal(calendarDate(days[0]), '2025-12-29');
  assert.equal(calendarDate(days.at(-1)), '2026-02-08');
});
