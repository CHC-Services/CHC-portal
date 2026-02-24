import "./globals.css";
import { getUserFromCookie } from "@/lib/getUserFromCookie";
import Banner from "./components/Banner";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserFromCookie();

  return (
    <html lang="en">
      <body className="bg-[#D9E1E8]">
        <Banner user={user} />
        {children}
      </body>
    </html>
  );
}