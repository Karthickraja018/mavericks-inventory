import "./globals.css";
export const metadata = { title: "Mavericks Inventory" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
