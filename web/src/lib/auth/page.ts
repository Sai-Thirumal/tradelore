import { redirect } from 'next/navigation';
import { getAuthUser } from './session';

export async function requirePageAuth() {
  const user = await getAuthUser();
  if (!user) redirect('/');
  return user;
}
