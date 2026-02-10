import { NextResponse } from "next/server";
import { getDistinctBreeds } from "@/lib/data";

export async function GET() {
  const breeds = await getDistinctBreeds();
  return NextResponse.json(breeds);
}
