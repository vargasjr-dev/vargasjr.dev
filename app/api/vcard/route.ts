import { NextResponse } from "next/server";

export const GET = () => {
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:VargasJR",
    "ORG:VargasJR LLC",
    "TEL;TYPE=CELL:+18336597438",
    "EMAIL:hello@vargasjr.dev",
    "URL:https://vargasjr.dev",
    "END:VCARD",
  ].join("\r\n");

  return new NextResponse(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vargasjr.vcf"',
      "Cache-Control": "public, max-age=86400",
    },
  });
};
