import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { type NextRequest } from "next/server";

const handler = async (req: NextRequest, ctx: any) => {
  return NextAuth(req, ctx, getAuthOptions(req));
};

export { handler as GET, handler as POST };
