"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// ADR-13: light / dark / system with a blocking script that prevents a flash of the
// wrong theme. `class` matches the `dark` custom variant in globals.css.
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    />
  );
}
