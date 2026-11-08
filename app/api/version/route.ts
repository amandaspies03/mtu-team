// The build this server is running. Open tabs compare it with the build they loaded to know when to refresh.
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev' }, { headers: { 'Cache-Control': 'no-store' } });
}
