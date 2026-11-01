import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { GoogleSignIn } from "./google-sign-in";

type AuthCardProps = {
  mode: "login" | "register";
  children: ReactNode;
};

const otherPage = {
  login: { href: "/register", prompt: "login.noAccount", link: "login.registerLink" },
  register: { href: "/login", prompt: "register.haveAccount", link: "register.loginLink" },
} as const;

/** Shared frame of /login and /register (US-01, US-02). */
export async function AuthCard({ mode, children }: AuthCardProps) {
  const t = await getTranslations("Auth");
  const other = otherPage[mode];

  return (
    <Card className="w-full">
      <CardHeader>
        <h1 className="text-xl font-semibold">{t(`${mode}.title`)}</h1>
        <CardDescription>{t(`${mode}.description`)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {children}
        <Suspense fallback={null}>
          <GoogleSignIn />
        </Suspense>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <p>
          {t(other.prompt)}{" "}
          <Link
            href={other.href}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t(other.link)}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
