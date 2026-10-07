import { Client } from "@notionhq/client";

/**
 * Notion API 클라이언트
 * NOTION_API_KEY는 Notion 연동(Integration)에서 발급한 시크릿 키를 사용하세요.
 */
export const notion = process.env.NOTION_API_KEY
  ? new Client({ auth: process.env.NOTION_API_KEY })
  : null;

export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_API_KEY && getDatabaseId());
}

/** 서버 전용 DB ID (클라이언트에 노출하지 않음) */
export function getDatabaseId(): string | null {
  return (
    process.env.DATABASE_ID?.trim() ||
    process.env.NEXT_PUBLIC_DATABASE_ID?.trim() ||
    null
  );
}
