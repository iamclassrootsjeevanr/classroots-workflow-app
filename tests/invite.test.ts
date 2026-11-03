import { describe, expect, it } from 'vitest';
import { generatePassword, inviteEmail, loginDetailsText, missingPasswordProblem, resetEmail, resetPasswordUrl, signInMethod, signInUrl } from '@/lib/invite';
import { passwordProblem } from '@/lib/password';

const office = ['classrootsedu.com'];

describe('signInMethod', () => {
  const base = { googleEnabled: true, officeDomains: office, hasGoogleAccount: false };
  it('sends office emails to Google', () => {
    expect(signInMethod({ ...base, email: 'asha@ClassrootsEdu.com' })).toBe('google');
  });
  it('sends anyone with a linked Google account to Google', () => {
    expect(signInMethod({ ...base, email: 'client@gmail.com', hasGoogleAccount: true })).toBe('google');
  });
  it('uses email + password for every other email', () => {
    expect(signInMethod({ ...base, email: 'client@gmail.com' })).toBe('password');
  });
  it('falls back to password while Google is not set up', () => {
    expect(signInMethod({ ...base, googleEnabled: false, email: 'asha@classrootsedu.com' })).toBe('password');
  });
});

describe('missingPasswordProblem', () => {
  const base = { active: true, officeDomains: office, hasPassword: false };
  it('needs a password for people outside the office', () => {
    expect(missingPasswordProblem({ ...base, email: 'client@gmail.com' })).toContain('Set a password');
  });
  it('is fine when a password is given or already set', () => {
    expect(missingPasswordProblem({ ...base, email: 'client@gmail.com', newPassword: 'abcdef12345' })).toBeNull();
    expect(missingPasswordProblem({ ...base, email: 'client@gmail.com', hasPassword: true })).toBeNull();
  });
  it('never needs one for office people, inactive people or people without an email', () => {
    expect(missingPasswordProblem({ ...base, email: 'asha@classrootsedu.com' })).toBeNull();
    expect(missingPasswordProblem({ ...base, active: false, email: 'client@gmail.com' })).toBeNull();
    expect(missingPasswordProblem({ ...base, email: '' })).toBeNull();
  });
});

describe('invite and login details', () => {
  const invite = { name: 'Asha', email: 'asha@classrootsedu.com', invitedBy: 'Jeevan', appUrl: 'https://work.example.com/', access: ['APK Testing (Tester)'] };

  it('links to the sign-in page with the email filled in', () => {
    expect(signInUrl('https://work.example.com/', 'a+b@x.com')).toBe('https://work.example.com/signin?email=a%2Bb%40x.com');
    const m = inviteEmail({ ...invite, method: 'google' });
    expect(m.text).toContain('https://work.example.com/signin?email=asha%40classrootsedu.com');
    expect(m.text).toContain('APK Testing (Tester)');
    expect(m.text).toContain('Sign in with Google');
  });
  it('gives a password user the temporary password the admin just set', () => {
    const m = inviteEmail({ ...invite, email: 'client@gmail.com', method: 'password', password: 'Temp12345abc' });
    expect(m.text).toContain('Email: client@gmail.com');
    expect(m.text).toContain('Password: Temp12345abc');
    expect(m.text).toContain('Forgot password?');
  });
  it('gives a set-password link when no new password was set, and never a password for Google users', () => {
    const link = inviteEmail({ ...invite, email: 'client@gmail.com', method: 'password', setPasswordUrl: 'https://w/reset-password?token=t' });
    expect(link.text).toContain('https://w/reset-password?token=t');
    expect(link.text).not.toContain('Password:');
    expect(inviteEmail({ ...invite, method: 'google', password: 'ignored1234' }).text).not.toContain('ignored1234');
  });
  it('builds the reset email with a one-hour link', () => {
    const url = resetPasswordUrl('https://work.example.com/', 'a/b+c');
    expect(url).toBe('https://work.example.com/reset-password?token=a%2Fb%2Bc');
    const m = resetEmail({ name: 'Asha', url });
    expect(m.text).toContain(url);
    expect(m.text).toContain('1 hour');
  });
  it('generates temporary passwords that pass the password rules', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(pw).toHaveLength(12);
      expect(passwordProblem(pw, 'someone@gmail.com')).toBeNull();
    }
  });
  it('builds login details an admin can share', () => {
    const t = loginDetailsText({ appUrl: 'https://work.example.com', email: 'c@gmail.com', password: 'Secret12345' });
    expect(t).toContain('Email: c@gmail.com');
    expect(t).toContain('Password: Secret12345');
  });
  it('escapes names in the HTML', () => {
    expect(inviteEmail({ ...invite, name: '<b>x</b>', method: 'password' }).html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
