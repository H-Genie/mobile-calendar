export type EventItem = {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  url: string | null;
  lastEdited: string | null;
};

type NotionProperties = Record<string, any>;

/** 공개 Notion 사이트 (로그인 없이 열람) */
const NOTION_SITE_BASE = "https://smiling-maraca-9c0.notion.site";

/** page id → 공개 사이트 URL */
export function toPublicNotionUrl(pageId: string): string {
  const compact = pageId.replace(/-/g, "");
  return `${NOTION_SITE_BASE}/${compact}`;
}

export function findPropNames(properties: NotionProperties): {
  titleProp: string | null;
  dateProp: string | null;
} {
  const entries = Object.entries(properties);
  return {
    titleProp: entries.find(([, p]) => p?.type === "title")?.[0] ?? null,
    dateProp: entries.find(([, p]) => p?.type === "date")?.[0] ?? null,
  };
}

export function mapNotionRows(
  rows: any[],
  titleProp: string | null,
  dateProp: string | null
): EventItem[] {
  return rows.map((row) => {
    const properties = row.properties ?? {};
    const titleVal = titleProp ? properties[titleProp] : null;
    const dateVal = dateProp ? properties[dateProp] : null;

    const title =
      titleVal && Array.isArray(titleVal.title) && titleVal.title.length > 0
        ? (titleVal.title[0]?.plain_text ?? "제목 없음")
        : "제목 없음";

    const date: string | null =
      dateVal && dateVal.date ? (dateVal.date.start ?? null) : null;

    const location: string | null =
      properties["장소"]?.rich_text?.[0]?.text?.content?.trim() || null;

    return {
      id: row.id,
      title,
      date,
      location,
      url: row.id ? toPublicNotionUrl(row.id) : null,
      lastEdited: (row.last_edited_time as string | null) ?? null,
    };
  });
}
