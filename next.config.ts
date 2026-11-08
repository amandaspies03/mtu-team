import type {NextConfig} from 'next';
const config:NextConfig={poweredByHeader:false,env:{NEXT_PUBLIC_BUILD_ID:process.env.VERCEL_GIT_COMMIT_SHA||process.env.VERCEL_DEPLOYMENT_ID||String(Date.now())},async headers(){return [{source:'/(.*)',headers:[{key:'Cache-Control',value:'private, no-store'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Frame-Options',value:'DENY'},{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},{key:'Permissions-Policy',value:'camera=(), geolocation=(), microphone=(), payment=()'},{key:'X-DNS-Prefetch-Control',value:'off'}]}]}};
export default config;

