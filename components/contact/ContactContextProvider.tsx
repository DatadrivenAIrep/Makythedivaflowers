"use client";
import * as React from "react";
import type { ContactOverride } from "@/lib/contact-subject";

type Ctx = {
  override: ContactOverride;
  setOverride: (o: ContactOverride) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
};

const ContactContext = React.createContext<Ctx | null>(null);

export function ContactContextProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = React.useState<ContactOverride>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <ContactContext.Provider value={{ override, setOverride, open, setOpen }}>
      {children}
    </ContactContext.Provider>
  );
}

export function useContactContext(): Ctx {
  const ctx = React.useContext(ContactContext);
  if (!ctx) {
    throw new Error("useContactContext must be used inside <ContactContextProvider>");
  }
  return ctx;
}

export function useSetContactSubject(override: ContactOverride): void {
  const { setOverride } = useContactContext();
  const key = JSON.stringify(override);
  React.useEffect(() => {
    setOverride(override);
    return () => setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
