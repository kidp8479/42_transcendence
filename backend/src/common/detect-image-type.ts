// Client-declared Content-Type (Express.Multer.File#mimetype) is fully
// attacker-controlled - a request can label an SVG (which can carry
// <script>) as "image/svg+xml" and a bare `mimetype.startsWith("image/")`
// check lets it straight through. Sniffing the actual bytes against a small
// raster allowlist closes that off, and callers should store/serve the
// sniffed mimetype - never the client's header - so a stored object can
// never end up served back with an attacker-chosen Content-Type.
const SIGNATURES: { mimetype: string; matches: (buf: Buffer) => boolean }[] = [
  {
    mimetype: "image/png",
    matches: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    mimetype: "image/jpeg",
    matches: (buf) =>
      buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mimetype: "image/gif",
    matches: (buf) =>
      buf.length >= 6 &&
      buf[0] === 0x47 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x38 &&
      (buf[4] === 0x37 || buf[4] === 0x39) &&
      buf[5] === 0x61,
  },
  {
    mimetype: "image/svg",
    matches: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x3c &&
      buf[1] === 0x73 &&
      buf[2] === 0x76 &&
      buf[3] === 0x67,
  },
];

export function detectImageMimetype(buffer: Buffer): string | undefined {
  return SIGNATURES.find((signature) => signature.matches(buffer))?.mimetype;
}
