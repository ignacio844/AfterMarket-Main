import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isPortalUserAllowed } from "@/lib/portal-auth";

export const { handlers, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    signIn({ user, profile }) {
      return isPortalUserAllowed(user.email ?? profile?.email);
    },
  },
  session: { strategy: "jwt" },
  trustHost: true,
});
