/**
 * src/services/skills-sh.ts
 *
 * Query functions for the skills_sh table (skills.sh leaderboard cache).
 * Used by the /agent-skills page and homepage teaser.
 */

import { asc, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { skillsSh } from '../db/schema';

import type { SkillSh } from '../db/schema';

/**
 * Returns top skills by all-time rank.
 */
export async function getTopSkills(limit = 10): Promise<SkillSh[]> {
  return db
    .select()
    .from(skillsSh)
    .where(isNotNull(skillsSh.allTimeRank))
    .orderBy(asc(skillsSh.allTimeRank))
    .limit(limit);
}

/**
 * Returns trending skills (24h) by trending rank.
 */
export async function getTrendingSkills(limit = 10): Promise<SkillSh[]> {
  return db
    .select()
    .from(skillsSh)
    .where(isNotNull(skillsSh.trendingRank))
    .orderBy(asc(skillsSh.trendingRank))
    .limit(limit);
}

/**
 * Returns the most recent scraped_at timestamp.
 */
export async function getLastUpdated(): Promise<number | null> {
  const result = await db
    .select({ last: sql<number>`MAX(${skillsSh.scrapedAt})` })
    .from(skillsSh);
  return result[0]?.last ?? null;
}
