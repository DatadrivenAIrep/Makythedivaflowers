// lib/print-render.tsx
import "server-only";
import React from "react";
import { Document, Page, Text, renderToBuffer, StyleSheet } from "@react-pdf/renderer";
import type { Order } from "@/types/order";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10 },
});

export async function renderOrderPdf(order: Order): Promise<Buffer> {
  const element = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text>ORDER {order.id}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(element);
}
