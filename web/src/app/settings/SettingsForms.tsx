'use client';
import Image from 'next/image';
import { useActionState, useState } from 'react';
import { changePassword, renameUser, saveProfile, type FormState } from '@/app/actions/profile';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';
import { AVATARS, avatarSrc } from '@/lib/format';
import type { Profile } from '@/lib/types';

function Result({ s }: { s: FormState }) {
  if (s?.error) return <Notice tone="error">{s.error}</Notice>;
  if (s?.ok) return <Notice tone="ok">{s.ok}</Notice>;
  return null;
}

export function SettingsForms({ profile }: { profile: Profile }) {
  const [avatar, setAvatar] = useState(profile.avatar);
  const [pState, pAction] = useActionState<FormState, FormData>(saveProfile, undefined);
  const [nState, nAction] = useActionState<FormState, FormData>(renameUser, undefined);
  const [pwState, pwAction] = useActionState<FormState, FormData>(changePassword, undefined);

  return (
    <div className="mt-8 space-y-8">
      <form action={pAction} className="card space-y-5 p-6">
        <h2 className="h-display text-lg">Profile</h2>
        <Result s={pState} />
        <input type="hidden" name="avatar" value={avatar} />
        <div>
          <div className="label">Avatar</div>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            {AVATARS.map(a => (
              <button type="button" key={a} onClick={() => setAvatar(a)} aria-label={a} aria-pressed={avatar === a}
                className={`overflow-hidden rounded-md border-2 transition ${avatar === a ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <Image src={avatarSrc(a)} alt="" width={64} height={64} className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bio">About me</label>
          <textarea id="bio" name="bio" maxLength={280} rows={3} defaultValue={profile.bio} className="input" placeholder="Main hero, favourite race, when you usually play…" />
        </div>
        <SubmitButton>Save profile</SubmitButton>
      </form>

      <form action={nAction} className="card space-y-4 p-6">
        <h2 className="h-display text-lg">Username</h2>
        <p className="text-sm text-muted">Currently <b className="text-ink">{profile.username}#{profile.tag}</b>. Changing the name gives you a new number, and friends keep you either way.</p>
        <Result s={nState} />
        <div className="flex gap-2">
          <input name="username" required maxLength={12} defaultValue={profile.username} className="input" />
          <SubmitButton className="btn shrink-0">Change</SubmitButton>
        </div>
      </form>

      <form action={pwAction} className="card space-y-4 p-6">
        <h2 className="h-display text-lg">Password</h2>
        <p className="text-sm text-muted">Signed in with Google only? Setting a password lets you also log in with your email.</p>
        <Result s={pwState} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="password" type="password" minLength={8} required placeholder="New password" autoComplete="new-password" className="input" />
          <input name="confirm" type="password" required placeholder="Confirm" autoComplete="new-password" className="input" />
        </div>
        <SubmitButton className="btn">Change password</SubmitButton>
      </form>
    </div>
  );
}
