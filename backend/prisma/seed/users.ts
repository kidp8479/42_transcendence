import { PrismaClient, User } from "@prisma/client";
import { registerSeedUser } from "./register-user";

// 1. Users (sorry girls, it's alphabetical order)
export async function seedUsers(prisma: PrismaClient): Promise<{
  andrei: User;
  carlos: User;
  christophe: User;
  diana: User;
  pauline: User;
  emptyuser: User;
}> {
  const usersData = [
    { username: "andrei", campus: "42 London" },
    { username: "carlos", campus: "42 Paris" },
    { username: "christophe", campus: "42 Paris" },
    { username: "diana", campus: "42 Paris" },
    { username: "pauline", campus: "42 Paris" },
    { username: "emptyuser", campus: "42 Void" },
  ];

  const createdUsers: Record<string, User> = {};

  for (const u of usersData) {
    const email = `${u.username}@42.fr`;
    const userId = await registerSeedUser(prisma, email, u.username);
    // register() has no "campus" field (that's a profile detail, not part of
    // local auth) - set it separately with a plain prisma update
    createdUsers[u.username] = await prisma.user.update({
      where: { id: userId },
      data: { campus: u.campus },
    });
  }

  return createdUsers as {
    andrei: User;
    carlos: User;
    christophe: User;
    diana: User;
    pauline: User;
    emptyuser: User;
  };
}
