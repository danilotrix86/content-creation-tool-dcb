import { NextRequest, NextResponse } from "next/server";
import {
  getArticleById,
  SUPABASE_NOT_CONFIGURED,
} from "@/lib/supabase/articles";
import { isSupabaseConfigured } from "@/lib/supabase/save-article";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: SUPABASE_NOT_CONFIGURED },
      { status: 503 }
    );
  }

  const { id } = await params;

  try {
    const article = await getArticleById(id);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json(article);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
