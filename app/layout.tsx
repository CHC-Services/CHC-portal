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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="pt-[220px] md:pt-[200px] pb-16 md:pb-0" >
        <Banner user={user} />
        <div className="page-wrap px-4 sm:px-6">
          {children}
        </div>
      </body>
    </html>
  );
}