import { NextRequest, NextResponse } from "next/server";
import {
  listArticles,
  SUPABASE_NOT_CONFIGURED,
} from "@/lib/supabase/articles";
import { isSupabaseConfigured } from "@/lib/supabase/save-article";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: SUPABASE_NOT_CONFIGURED },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50)
  );
  const offset = Math.max(
    0,
    parseInt(searchParams.get("offset") ?? "0", 10) || 0
  );

  try {
    const articles = await listArticles({ limit, offset });
    return NextResponse.json({ articles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list articles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
