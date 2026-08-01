"use client";

import { createContext, useContext } from "react";

/** Toolkit-scoped reveal for approved account values. Not persisted. */
const KeysVisibilityContext = createContext(false);

export function KeysVisibilityProvider({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <KeysVisibilityContext.Provider value={visible}>
      {children}
    </KeysVisibilityContext.Provider>
  );
}

export function useKeysVisible(): boolean {
  return useContext(KeysVisibilityContext);
}
