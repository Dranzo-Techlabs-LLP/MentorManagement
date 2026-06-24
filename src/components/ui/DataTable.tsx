import { EmptyState } from "./primitives";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  empty = "No records found.",
  getKey,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  getKey: (row: T, i: number) => string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={empty} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            {columns.map((c, i) => (
              <th key={i} className="table-th">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, i) => (
            <tr key={getKey(row, i)} className="transition hover:bg-slate-50/60">
              {columns.map((c, j) => (
                <td key={j} className={`table-td ${c.className ?? ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
