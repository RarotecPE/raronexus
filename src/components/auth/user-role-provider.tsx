"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { USER_ROLE_COOKIE_NAME, type UserRole } from "./constants";

export { USER_ROLE_COOKIE_NAME, type UserRole };

interface UserRoleContextValue {
  cachedRole: UserRole;
  setCachedRole: (role: UserRole) => void;
}

const UserRoleContext = createContext<UserRoleContextValue>({
  cachedRole: null,
  setCachedRole: () => {},
});

function getClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setClientCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function deleteClientCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function UserRoleProvider({
  initialRole,
  children,
}: {
  initialRole: UserRole;
  children: React.ReactNode;
}) {
  const [cachedRole, setCachedRoleState] = useState<UserRole>(initialRole);

  useEffect(() => {
    const roleFromCookie = getClientCookie(USER_ROLE_COOKIE_NAME);
    if (roleFromCookie === "admin" || roleFromCookie === "user") {
      setCachedRoleState(roleFromCookie);
    } else if (roleFromCookie === null && initialRole !== null) {
      setCachedRoleState(null);
    }
  }, [initialRole]);

  function setCachedRole(role: UserRole) {
    setCachedRoleState(role);
    if (role) {
      setClientCookie(USER_ROLE_COOKIE_NAME, role, 30 * 24 * 60 * 60);
    } else {
      deleteClientCookie(USER_ROLE_COOKIE_NAME);
    }
  }

  return (
    <UserRoleContext.Provider value={{ cachedRole, setCachedRole }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  return useContext(UserRoleContext);
}

