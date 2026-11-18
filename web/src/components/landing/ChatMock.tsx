// Static, illustrative Claude conversation for the landing page.
// Numbers come from DropOS's unit-economics model with default India COD assumptions.
export function ChatMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5">
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-2 text-xs font-medium text-zinc-500">Claude · DropOS connected</span>
      </div>
      <div className="space-y-4 p-5 text-sm">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-zinc-100 px-4 py-2.5 text-zinc-800">
          We&apos;re thinking posture belt ₹699 (cost ₹159), water bottle ₹449 (cost ₹190) and a portable blender ₹1,199 (cost ₹320). Which should we
          run?
        </div>
        <div className="flex gap-3">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">C</div>
          <div className="min-w-0 flex-1 space-y-3 text-zinc-700">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              ⚙ DropOS · analyzed 3 products
            </div>
            <p>I ran your numbers with India COD reality: 70% COD, 30% of COD orders returned, ₹220 ad cost per order.</p>
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Product</th>
                    <th className="px-3 py-1.5 text-right font-medium">Looks like</th>
                    <th className="px-3 py-1.5 text-right font-medium">Actually / order</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-zinc-100">
                    <td className="px-3 py-1.5">Blender</td>
                    <td className="px-3 py-1.5 text-right text-zinc-500">68% margin</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">+₹342 ✅</td>
                  </tr>
                  <tr className="border-t border-zinc-100">
                    <td className="px-3 py-1.5">Posture belt</td>
                    <td className="px-3 py-1.5 text-right text-zinc-500">68% margin</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">+₹90 ✅</td>
                  </tr>
                  <tr className="border-t border-zinc-100 bg-red-50/50">
                    <td className="px-3 py-1.5">Water bottle</td>
                    <td className="px-3 py-1.5 text-right text-zinc-500">43% margin</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-red-600">−₹125 ❌</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Drop the water bottle: every order loses money once returns and ads are counted. Want me to find IndiaMART suppliers for the blender and
              posture belt?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
