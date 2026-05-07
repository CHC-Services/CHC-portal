import "./globals.css";
import { Cormorant_Upright } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { getUserFromCookie } from "@/lib/getUserFromCookie";
import Banner from "./components/Banner";
import Footer from "./components/Footer";
import PullToRefresh from "./components/PullToRefresh";
import NurseSideNav from "./components/NurseSideNav";

const cormorantUpright = Cormorant_Upright({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal"],
  variable: "--font-cormorant",
  display: "swap",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserFromCookie();

  return (
    <html lang="en" className={cormorantUpright.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="pt-[220px] md:pt-[200px]">
        <Banner user={user} />
        {user?.role === 'nurse' && <NurseSideNav />}
        <PullToRefresh />
        <div className={`page-wrap px-4 sm:px-6${user?.role === 'nurse' ? ' lg:pl-[calc(10vw+1.5rem)]' : ''}`}>
          {children}
        </div>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}