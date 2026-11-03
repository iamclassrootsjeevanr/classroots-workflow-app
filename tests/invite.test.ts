import { describe, expect, it } from 'vitest';
import { inviteEmail, signInMethod, signInUrl } from '@/lib/invite';

const base = { googleEnabled: true, allowedDomains: ['classrootsedu.com'], hasGoogleAccount: false, hasPassword: false };

describe('signInMethod', () => {
  it('sends organisation staff to Google', () => {
    expect(signInMethod({ ...base, email: 'asha@ClassrootsEdu.com' })).toBe('google');
  });
  it('sends anyone with a linked Google account to Google', () => {
    expect(signInMethod({ ...base, email: 'client@gmail.com', hasGoogleAccount: true })).toBe('google');
  });
  it('uses the password for other emails when one is set, else an email link', () => {
    expect(signInMethod({ ...base, email: 'client@school.org', hasPassword: true })).toBe('password');
    expect(signInMethod({ ...base, email: 'client@school.org' })).toBe('link');
  });
  it('never picks Google when it is not set up', () => {
    expect(signInMethod({ ...base, googleEnabled: false, email: 'asha@classrootsedu.com' })).toBe('link');
  });
});

describe('inviteEmail', () => {
  const invite = { name: 'Asha', email: 'asha@classrootsedu.com', invitedBy: 'Jeevan', appUrl: 'https://work.example.com/', access: ['APK Testing (Tester)'] };

  it('links to the sign-in page with the email filled in', () => {
    expect(signInUrl('https://work.example.com/', 'a+b@x.com')).toBe('https://work.example.com/signin?email=a%2Bb%40x.com');
    const m = inviteEmail({ ...invite, method: 'google' });
    expect(m.text).toContain('https://work.example.com/signin?email=asha%40classrootsedu.com');
    expect(m.text).toContain('APK Testing (Tester)');
    expect(m.text).toContain('Sign in with Google');
  });
  it('tells password and link users what to do, never the password itself', () => {
    expect(inviteEmail({ ...invite, method: 'password' }).text).toContain('password Jeevan shares with you');
    expect(inviteEmail({ ...invite, method: 'link' }).text).toContain('Send link');
  });
  it('escapes names in the HTML', () => {
    expect(inviteEmail({ ...invite, name: '<b>x</b>', method: 'link' }).html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
