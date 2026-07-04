import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RankTable from "@/components/admin/metrics/RankTable";

describe("RankTable", () => {
  it("renders a header and one row per item", () => {
    render(
      <RankTable
        nameHeader="Producto"
        valueHeader="Cantidad"
        rows={[
          { key: "a", name: "Ramo Rosa", value: "12" },
          { key: "b", name: "Caja Lujo", value: "8", sub: "$120.00" },
        ]}
        emptyLabel="Sin datos"
      />,
    );
    expect(screen.getByText("Producto")).toBeDefined();
    expect(screen.getByText("Ramo Rosa")).toBeDefined();
    expect(screen.getByText("$120.00")).toBeDefined();
  });

  it("renders the empty label when there are no rows", () => {
    render(<RankTable nameHeader="Zona" valueHeader="Ingresos" rows={[]} emptyLabel="Sin datos" />);
    expect(screen.getByText("Sin datos")).toBeDefined();
  });
});
