import { db } from "@/lib/db";
import type { Prisma, Tag } from "@prisma/client";

export const MAX_TAGS_PER_TRANSACTION = 10;
export const MAX_TAG_LENGTH = 50;

export function normalizeTagName(name: string): string {
  return name.trim();
}

export function sanitizeTagNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  names.forEach((name) => {
    const normalized = normalizeTagName(name);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result.slice(0, MAX_TAGS_PER_TRANSACTION);
}

export async function upsertTagsForOrg(
  organizationId: string,
  names: string[]
): Promise<Tag[]> {
  const normalizedNames = sanitizeTagNames(names);
  if (normalizedNames.length === 0) return [];

  const lowerNames = normalizedNames.map((name) => name.toLowerCase());

  const existing = await db.tag.findMany({
    where: {
      organizationId,
      nameLower: { in: lowerNames },
    },
  });

  const existingMap = new Map(existing.map((tag) => [tag.nameLower, tag]));
  const missing = normalizedNames.filter(
    (name) => !existingMap.has(name.toLowerCase())
  );

  const created: Tag[] = [];
  for (const name of missing) {
    const tag = await db.tag.create({
      data: {
        organizationId,
        name,
        nameLower: name.toLowerCase(),
      },
    });
    created.push(tag);
  }

  return [...existing, ...created];
}

export function buildTagFilter(
  tagIds: string[] | undefined,
  mode: "any" | "all" = "any"
): Prisma.TransactionWhereInput {
  if (!tagIds || tagIds.length === 0) return {};

  if (mode === "all") {
    return {
      AND: tagIds.map((tagId) => ({
        transactionTags: {
          some: { tagId },
        },
      })),
    };
  }

  return {
    transactionTags: {
      some: {
        tagId: { in: tagIds },
      },
    },
  };
}
