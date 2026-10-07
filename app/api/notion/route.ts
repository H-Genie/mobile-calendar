import { NextRequest, NextResponse } from "next/server";
import { notion, isNotionConfigured, getDatabaseId } from "@/lib/notion";
import { findPropNames, mapNotionRows } from "@/lib/events";
import { todayISO } from "@/lib/date";
import { buildNotionQuery, type Direction } from "@/lib/notionQuery";

type NotionClient = NonNullable<typeof notion>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type SchemaCache = {
  titleProp: string | null;
  dateProp: string | null;
  fetchedAt: number;
};

const SCHEMA_TTL_MS = 5 * 60 * 1000;
const schemaCache = new Map<string, SchemaCache>();

async function getSchema(
  client: NotionClient,
  databaseId: string
): Promise<SchemaCache> {
  const cached = schemaCache.get(databaseId);
  if (cached && Date.now() - cached.fetchedAt < SCHEMA_TTL_MS) {
    return cached;
  }

  const database = await client.databases.retrieve({
    database_id: databaseId,
  });
  const properties = (database as any).properties ?? {};
  const names = findPropNames(properties);
  const next: SchemaCache = { ...names, fetchedAt: Date.now() };
  schemaCache.set(databaseId, next);
  return next;
}

/**
 * Notion Database 페이지네이션 API
 *
 * GET /api/notion?direction=initial|future|past
 *   &pageSize=20
 *   &cursor=...
 *   &before=YYYY-MM-DD
 *   &after=YYYY-MM-DD
 *   &title=am   (선택, 서버 필터)
 */
export async function GET(request: NextRequest) {
  if (!isNotionConfigured() || !notion) {
    return NextResponse.json(
      {
        error:
          "NOTION_API_KEY / DATABASE_ID가 설정되지 않았습니다. .env에 추가하세요.",
      },
      { status: 503 }
    );
  }

  const client = notion as NotionClient;
  const databaseId = getDatabaseId()!;
  const searchParams = request.nextUrl.searchParams;

  const direction = (searchParams.get("direction") ?? "initial") as Direction;
  const cursor = searchParams.get("cursor");
  const beforeParam = searchParams.get("before");
  const afterParam = searchParams.get("after");
  const titleQuery = searchParams.get("title")?.trim() || null;

  const pageSize = Math.min(
    Math.max(Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE
  );

  if (!["initial", "future", "past"].includes(direction)) {
    return NextResponse.json(
      { error: "direction은 initial | future | past 중 하나여야 합니다." },
      { status: 400 }
    );
  }

  if (direction === "past" && !beforeParam) {
    return NextResponse.json(
      { error: "past 조회에는 before(YYYY-MM-DD)가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const { titleProp, dateProp } = await getSchema(client, databaseId);

    if (!dateProp) {
      return NextResponse.json(
        { error: "날짜(date) 속성이 있는 Notion DB가 필요합니다." },
        { status: 400 }
      );
    }

    if (titleQuery && !titleProp) {
      return NextResponse.json(
        { error: "제목(title) 속성이 있는 Notion DB가 필요합니다." },
        { status: 400 }
      );
    }

    const { filter, sortDirection } = buildNotionQuery({
      direction,
      dateProp,
      titleProp,
      titleQuery,
      beforeParam,
      afterParam,
      today: todayISO(),
    });

    const response = await client.databases.query({
      database_id: databaseId,
      page_size: pageSize,
      filter,
      sorts: [
        {
          property: dateProp,
          direction: sortDirection,
        },
      ],
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    let events = mapNotionRows(response.results ?? [], titleProp, dateProp);

    if (direction === "past") {
      events = events.reverse();
    }

    return NextResponse.json({
      events,
      hasMore: response.has_more ?? false,
      nextCursor: response.next_cursor ?? null,
      direction,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Notion 데이터베이스 조회 중 오류가 발생했습니다: " + message,
      },
      { status: 500 }
    );
  }
}
