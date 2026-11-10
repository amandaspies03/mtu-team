import {NextRequest,NextResponse} from 'next/server';
// A fresh nonce authorizes only the scripts rendered for this response.
export function proxy(request:NextRequest){
 const nonce=btoa(crypto.randomUUID());
 const db=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://rjdbqjcxodfecnlhehwu.supabase.co';
 const origin=new URL(db).origin,ws=origin.replace(/^https:/,'wss:');
 const development=process.env.NODE_ENV==='development';
 const policy=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${development?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'",`connect-src 'self' ${origin} ${ws} https://api.pwnedpasswords.com${development?' ws:':''}`,"img-src 'self' data: blob:","font-src 'self' data:","media-src 'self' blob: data:","worker-src 'self' blob:","frame-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'",...(development?[]:['upgrade-insecure-requests'])].join('; ');
 const headers=new Headers(request.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',policy);
 const response=NextResponse.next({request:{headers}});response.headers.set('Content-Security-Policy',policy);return response;
}
export const config={matcher:['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)']};
