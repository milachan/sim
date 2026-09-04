import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: Role;
      wajibGantiPassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    username: string;
    wajibGantiPassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    username?: string;
    wajibGantiPassword?: boolean;
  }
}
