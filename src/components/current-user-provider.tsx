"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type CurrentUser = {
  firstName: string;
};

type CurrentUserProviderProps = {
  children: ReactNode;
  user: {
    name?: string;
    email?: string;
  };
};

const CurrentUserContext = createContext<CurrentUser>({ firstName: "Usuario" });

function formatFirstName(name?: string, email?: string) {
  const value = name?.trim().split(/\s+/)[0] || email?.split("@")[0] || "Usuario";
  return value.charAt(0).toLocaleUpperCase("es-AR") + value.slice(1).toLocaleLowerCase("es-AR");
}

export function CurrentUserProvider({ children, user }: CurrentUserProviderProps) {
  const currentUser = useMemo(
    () => ({ firstName: formatFirstName(user.name, user.email) }),
    [user.email, user.name],
  );

  return <CurrentUserContext.Provider value={currentUser}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
