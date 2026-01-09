import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Tabs.Content value={value} className="focus:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      {children}
    </Tabs.Content>
  );
}
