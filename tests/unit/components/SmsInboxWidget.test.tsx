import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SmsInboxWidget from "@/components/admin/dashboard/SmsInboxWidget";
import type { AttentionItem } from "@/lib/attention";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
}));

function sms(n: number, over: Partial<AttentionItem> = {}): AttentionItem {
  return {
    kind: "sms",
    id: `sms:in_${n}`,
    createdAt: new Date(Date.now() - n * 60_000).toISOString(),
    label: `SMS · Cliente ${n}`,
    preview: `mensaje ${n}`,
    count: 1,
    conversationKey: `key ${n}`,
    ...over,
  };
}

describe("SmsInboxWidget", () => {
  it("shows a reassuring empty state when nothing is unread", () => {
    render(<SmsInboxWidget locale="es" items={[]} />);
    expect(screen.getByText("sms_widget_empty")).toBeInTheDocument();
    expect(screen.getByTestId("sms-widget")).not.toHaveAttribute("data-unread");
  });

  it("lists each conversation's name and preview, linking into the inbox", () => {
    render(<SmsInboxWidget locale="es" items={[sms(1, { count: 3 })]} />);
    expect(screen.getByText("Cliente 1")).toBeInTheDocument();
    expect(screen.getByText("mensaje 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cliente 1/ })).toHaveAttribute(
      "href",
      "/es/admin/messages?c=key%201",
    );
    expect(screen.getByTestId("sms-widget")).toHaveAttribute("data-unread", "true");
    expect(screen.getByTestId("sms-widget-total")).toHaveTextContent("3");
  });

  it("caps the list at five and says how many more", () => {
    render(<SmsInboxWidget locale="es" items={[1, 2, 3, 4, 5, 6, 7].map((n) => sms(n))} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText('sms_widget_more:{"count":2}')).toBeInTheDocument();
  });
});
