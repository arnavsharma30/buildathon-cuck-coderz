import { WorkspaceProvider } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
