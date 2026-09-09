import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const GET = () => {
  const photoBase64 = fs
    .readFileSync(path.join(process.cwd(), "public", "avatar-contact.jpg"))
    .toString("base64");

  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:JR;Vargas;;;",
    "FN:Vargas JR",
    "ORG:VargasJR LLC",
    "TEL;TYPE=CELL:+18336597438",
    "EMAIL:hello@vargasjr.dev",
    "URL:https://vargasjr.dev",
    `PHOTO;ENCODING=b;TYPE=JPEG:${photoBase64}`,
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
