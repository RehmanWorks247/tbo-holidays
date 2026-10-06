import { clerkMiddleware } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

// Initialize Clerk sessions here. Resource authorization belongs in the API;
// the protected layout and its client boundary handle the signed-out page experience.
const configuredMiddleware = clerkMiddleware();

export default function proxy(
  request: NextRequest,
  event: Parameters<typeof configuredMiddleware>[1],
) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    // Protected server layout renders only a setup state; it never renders private children.
    return NextResponse.next();
  }
  return configuredMiddleware(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
