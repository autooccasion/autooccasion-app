'use server';

import { cookies } from 'next/headers';
import { auth } from 'app/auth';

export async function saveApiKey(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const apiKey = formData.get('apiKey');
  if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) return;

  cookies().set('gp_api_key', apiKey, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
}
