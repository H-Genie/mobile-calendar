import { Client } from "@notionhq/client";

/**
 * Notion API 클라이언트
 * NOTION_API_KEY는 Notion 연동(Integration)에서 발급한 시크릿 키를 사용하세요.
 */
export const notion =
  process.env.NOTION_API_KEY
    ? new Client({ auth: process.env.NOTION_API_KEY })
    : null;

export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_API_KEY);
}
