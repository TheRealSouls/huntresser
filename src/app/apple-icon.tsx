import { ImageResponse } from "next/og";

// iOS home screen and Safari use a PNG; other browsers use icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#dc332a"/><path d="M10 8h12v5a6 6 0 0 1-12 0z" fill="#fff"/><path d="M10 10H7.5a3.2 3.2 0 0 0 3.3 4M22 10h2.5a3.2 3.2 0 0 1-3.3 4" fill="none" stroke="#fff" stroke-width="1.8"/><rect x="14.5" y="18.5" width="3" height="3.5" fill="#fff"/><rect x="11" y="22" width="10" height="2.6" rx="0.6" fill="#fff"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={180} height={180} alt="" />
    ),
    size,
  );
}
