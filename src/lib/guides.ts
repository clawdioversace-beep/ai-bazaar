import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const GUIDES_DIR = path.join(process.cwd(), 'content', 'guides');

export interface GuideFrontmatter {
  slug: string;
  title: string;
  tagline: string;
  difficulty: 'beginner' | 'intermediate';
  readingTime: string;
  category: 'getting-started' | 'openclaw' | 'ecosystem' | 'meta';
  tags: string[];
  relatedPacks: string[];
  relatedTools: string[];
  publishedAt: string;
  updatedAt?: string;
  nextGuide?: string;
  prevGuide?: string;
}

export interface Guide {
  frontmatter: GuideFrontmatter;
  content: string;
}

export interface GuideSummary {
  slug: string;
  title: string;
  tagline: string;
  difficulty: 'beginner' | 'intermediate';
  readingTime: string;
  category: string;
  tags: string[];
  publishedAt: string;
}

const CATEGORY_ORDER: Record<string, number> = {
  'getting-started': 0,
  'openclaw': 1,
  'ecosystem': 2,
  'meta': 3,
};

/**
 * List all guides with summary info (no body content).
 * Optionally filter by category.
 */
export function listGuides(category?: string): GuideSummary[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];

  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.mdx'));

  const guides = files
    .map((file) => {
      const raw = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8');
      const { data } = matter(raw);
      return {
        slug: data.slug as string,
        title: data.title as string,
        tagline: data.tagline as string,
        difficulty: data.difficulty as 'beginner' | 'intermediate',
        readingTime: data.readingTime as string,
        category: data.category as string,
        tags: (data.tags as string[]) || [],
        publishedAt: data.publishedAt as string,
      };
    })
    .filter((g) => !category || g.category === category)
    .sort((a, b) => {
      // Sort by category order first, then by publishedAt
      const catDiff =
        (CATEGORY_ORDER[a.category] ?? 99) -
        (CATEGORY_ORDER[b.category] ?? 99);
      if (catDiff !== 0) return catDiff;
      return a.publishedAt.localeCompare(b.publishedAt);
    });

  return guides;
}

/**
 * Get a single guide by slug, including full MDX content.
 */
export function getGuide(slug: string): Guide | null {
  if (!fs.existsSync(GUIDES_DIR)) return null;

  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.mdx'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8');
    const { data, content } = matter(raw);

    if (data.slug === slug) {
      return {
        frontmatter: data as GuideFrontmatter,
        content,
      };
    }
  }

  return null;
}

/**
 * Get all unique categories from published guides.
 */
export function getGuideCategories(): { value: string; label: string; count: number }[] {
  const guides = listGuides();
  const counts = new Map<string, number>();

  for (const guide of guides) {
    counts.set(guide.category, (counts.get(guide.category) || 0) + 1);
  }

  const CATEGORY_LABELS: Record<string, string> = {
    'getting-started': 'Getting Started',
    'openclaw': 'OpenClaw',
    'ecosystem': 'Ecosystem & Tools',
    'meta': 'Resources',
  };

  return Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      label: CATEGORY_LABELS[value] || value,
      count,
    }))
    .sort(
      (a, b) =>
        (CATEGORY_ORDER[a.value] ?? 99) - (CATEGORY_ORDER[b.value] ?? 99)
    );
}
