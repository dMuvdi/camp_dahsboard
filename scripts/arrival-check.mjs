// Self-check for supabase/functions/_shared/arrival.ts, the NFC self check-in rule.
// Run: node --experimental-strip-types scripts/arrival-check.mjs
import assert from 'node:assert/strict'
import { arrival } from '../supabase/functions/_shared/arrival.ts'
import { camp } from '../supabase/functions/_shared/camp.ts'

const at = (iso) => new Date(iso)
const checkInTime = at('2026-11-13T07:00:00-05:00')
const checkOutTime = at('2026-11-15T10:00:00-05:00')
const before = at('2026-11-09T12:00:00-05:00')
const camper = (s) => ({ has_signed: true, checked_in: false, checked_out: false, ...s })

assert.deepEqual(arrival(camper({}), checkInTime).update, { checked_in: true })
assert.equal(arrival(camper({}), before).ok, false, 'no check-in before the window')
assert.match(arrival(camper({}), before).message, new RegExp(camp.checkIn.label))
assert.equal(arrival(camper({ has_signed: false }), checkInTime).ok, false, 'unsigned campers go to staff')
assert.equal(arrival(camper({ has_signed: null }), checkInTime).ok, false)
assert.equal(arrival(camper({ checked_in: true }), checkInTime).update, null, 'a second tap at the dock changes nothing')
assert.equal(arrival(camper({ checked_in: true }), checkInTime).ok, true)
assert.deepEqual(arrival(camper({ checked_in: true }), checkOutTime).update, { checked_out: true })
assert.equal(arrival(camper({ checked_in: true, checked_out: true }), checkOutTime).update, null)
assert.equal(arrival(camper({}), checkOutTime).ok, false, 'no check-in on the last day')
assert.deepEqual(arrival(camper({}), at(camp.checkIn.start)).update, { checked_in: true }, 'window start is inclusive')
assert.deepEqual(arrival(camper({}), at(camp.checkIn.end)).update, { checked_in: true }, 'window end is inclusive')
console.log('arrival-check: ok')
