import { NextResponse } from "next/server";
import { submitEnquiry } from "@/lib/boxdice";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.name || !body?.email || !body?.message) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    const result = await submitEnquiry({
      name: String(body.name),
      email: String(body.email),
      phone: body.phone ? String(body.phone) : undefined,
      message: String(body.message),
      listingId: body.listingId ? String(body.listingId) : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}
