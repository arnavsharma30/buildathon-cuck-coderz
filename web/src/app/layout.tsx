import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WorkspaceProvider } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DropOS: AI co-pilot for the MU Dropship Challenge",
  description: "Product research, IndiaMART sourcing, creatives, Meta ads and RTO control in one CRM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen">
        <WorkspaceProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
