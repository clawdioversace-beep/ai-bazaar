'use server';

import { db } from '@/db/client';
import { subscribers } from '@/db/schema';

export async function subscribe(formData: FormData) {
  const email = formData.get('email') as string;
  const source = (formData.get('source') as string) || 'hero';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  try {
    await db.insert(subscribers).values({
      id: crypto.randomUUID(),
      email: email.toLowerCase().trim(),
      source,
      createdAt: new Date(),
    });
    return { success: true };
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      return { success: true }; // Already subscribed — treat as success
    }
    return { error: 'Something went wrong. Please try again.' };
  }
}
