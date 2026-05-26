import { describe, it, expect } from 'vitest';
import { PLATFORMS, getPlatformByDomain } from '../src/platforms.js';

describe('getPlatformByDomain', () => {
  it('matches exact domain', () => {
    const p = getPlatformByDomain('westlaw.com');
    expect(p.key).toBe('westlaw');
    expect(p.name).toBe('Westlaw');
    expect(p.tier).toBe('free');
  });

  it('matches www subdomain', () => {
    expect(getPlatformByDomain('www.westlaw.com').key).toBe('westlaw');
  });

  it('matches Westlaw UK domain', () => {
    expect(getPlatformByDomain('uk.westlaw.co.uk').key).toBe('westlaw');
    expect(getPlatformByDomain('www.westlaw.co.uk').key).toBe('westlaw');
  });

  it('matches LexisNexis primary domain', () => {
    expect(getPlatformByDomain('www.lexisnexis.com').key).toBe('lexisnexis');
  });

  it('matches advance.lexis.com', () => {
    expect(getPlatformByDomain('advance.lexis.com').key).toBe('lexisnexis');
  });

  it('matches bloomberglaw.com', () => {
    expect(getPlatformByDomain('bloomberglaw.com').key).toBe('bloomberglaw');
  });

  it('matches pacer.gov', () => {
    expect(getPlatformByDomain('pacer.gov').key).toBe('pacer');
  });

  it('matches pacer subdomain (e.g. ecf.dcd.uscourts.gov is not a listed domain)', () => {
    // pacer.uscourts.gov is listed; ecf.dcd.uscourts.gov is not
    expect(getPlatformByDomain('pacer.uscourts.gov').key).toBe('pacer');
  });

  it('returns null for unknown domain', () => {
    expect(getPlatformByDomain('google.com')).toBeNull();
    expect(getPlatformByDomain('casetext.com')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getPlatformByDomain('')).toBeNull();
  });

  it('all paid-tier platforms are not westlaw', () => {
    const paid = Object.values(PLATFORMS).filter(p => p.tier === 'paid');
    expect(paid.length).toBeGreaterThan(0);
    paid.forEach(p => expect(p.name).not.toBe('Westlaw'));
  });

  it('westlaw is the only free-tier production platform', () => {
    const free = Object.values(PLATFORMS).filter(p => p.tier === 'free' && p.name !== 'Mock (localhost)');
    expect(free).toHaveLength(1);
    expect(free[0].name).toBe('Westlaw');
  });
});
