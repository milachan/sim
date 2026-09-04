import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Kredensial",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { username: credentials.username.trim() },
          include: { guru: { select: { status: true, deletedAt: true } } },
        });
        if (!user || !user.aktif) return null;

        // GURU harus punya data guru yang masih aktif (tidak dinonaktifkan / soft-delete).
        if (user.role === "GURU" && (!user.guruId || !user.guru || user.guru.status !== true || user.guru.deletedAt !== null)) {
          return null;
        }
        // WAKA yang punya guruId (mengajar) wajib gurunya aktif.
        if (user.role === "WAKA" && user.guruId && (!user.guru || user.guru.status !== true || user.guru.deletedAt !== null)) {
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return {
          id: user.id,
          name: user.nama,
          email: `${user.username}@sistem.internal`,
          role: user.role,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.username = (user as { username: string }).username;
      }
      // Selalu muat ulang status wajibGantiPassword dari DB agar JWT lama tidak
      // menahan flag setelah password diganti / admin mengubahnya.
      if (token.sub) {
        const u = await prisma.user.findUnique({ where: { id: token.sub }, select: { wajibGantiPassword: true } });
        if (u) token.wajibGantiPassword = u.wajibGantiPassword;
        else token.wajibGantiPassword = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as Role;
        session.user.username = token.username as string;
        session.user.id = token.sub as string;
        session.user.wajibGantiPassword = token.wajibGantiPassword as boolean;
      }
      return session;
    },
  },
};
