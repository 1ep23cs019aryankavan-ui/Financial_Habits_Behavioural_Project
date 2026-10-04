import { prisma } from "@/lib/db";
import {
  createSession,
  ensureUserDefaults,
  hashPassword,
} from "@/lib/auth";
import { HttpError, created, handle } from "@/lib/api";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  return handle(async () => {
    const body = registerSchema.parse(await request.json());

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      throw new HttpError("An account with that email already exists.", 409);
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(body.password),
      },
      select: { id: true, name: true, email: true },
    });

    await ensureUserDefaults(user.id);
    await createSession(user.id);

    return created({ user });
  });
}
