import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import { fieldErrors } from "./validation";

export type ApiErrorBody = {
  error: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Wraps a route handler so every failure mode returns a predictable JSON shape
 * instead of leaking stack traces.
 */
export async function handle(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json<ApiErrorBody>(
        { error: err.message },
        { status: err.status },
      );
    }

    if (err instanceof ZodError) {
      return NextResponse.json<ApiErrorBody>(
        {
          error: "Some fields need attention.",
          fieldErrors: fieldErrors(err),
        },
        { status: 400 },
      );
    }

    if (err instanceof HttpError) {
      return NextResponse.json<ApiErrorBody>(
        { error: err.message },
        { status: err.status },
      );
    }

    console.error("[api] unhandled error:", err);
    return NextResponse.json<ApiErrorBody>(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created<T>(data: T): Response {
  return NextResponse.json(data, { status: 201 });
}

export function noContent(): Response {
  return new NextResponse(null, { status: 204 });
}
