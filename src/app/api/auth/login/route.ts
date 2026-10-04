import { prisma } from "@/lib/db";
import {
  createSession,
  ensureUserDefaults,
  verifyPassword,
} from "@/lib/auth";
import { HttpError, handle, ok } from "@/lib/api";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  return handle(async () => {
    const body = loginSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    // Same message for unknown email and wrong password — do not leak which
    // emails are registered.
    const invalid = new HttpError("Incorrect email or password.", 401);
    if (!user) throw invalid;

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) throw invalid;

    await ensureUserDefaults(user.id);
    await createSession(user.id);

    return ok({ user: { id: user.id, name: user.name, email: user.email } });
  });
}
