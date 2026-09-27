/**
 * Creates (or resets) the shared demo login, demo@huntresser.gg / trophyhunter,
 * on a database that wasn't seeded with demo data (for example live PSN mode).
 * The demo account can't be deleted, can't link PSN and can't change its email.
 *
 *   npm run demo:user
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USERNAME } from "../src/lib/demo";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const clash = await prisma.user.findUnique({ where: { username: DEMO_USERNAME } });
  if (clash && clash.email !== DEMO_EMAIL) throw new Error(`The username "${DEMO_USERNAME}" belongs to someone else.`);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      username: DEMO_USERNAME,
      passwordHash,
      country: "GB",
      bio: "Demo account. Have a look around.",
      avatarHue: 4,
    },
    update: { passwordHash },
  });
  console.log(`Demo login ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (@${user.username})`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
