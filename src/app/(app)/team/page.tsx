import { AppTopbar } from "@/components/shared/AppTopbar";

export default function TeamPage() {
  return (
    <>
      <AppTopbar title="Team Management" />
      <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
        <div className="bg-white rounded-card border border-grey-mid shadow-card p-10 flex flex-col items-center text-center max-w-sm w-full">
          <div className="text-4xl mb-3">👥</div>
          <h2 className="text-[15px] font-bold text-surface-dark mb-2">Team Management — Coming in Sprint 3</h2>
          <p className="text-[13px] text-grey">This page is coming soon.</p>
        </div>
      </div>
    </>
  );
}
