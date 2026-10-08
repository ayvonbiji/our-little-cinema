export default function SetupNotice() {
  return (
    <div className="panel mx-auto mt-10 max-w-lg p-6 text-left text-sm leading-relaxed text-cream/80 animate-fadeIn">
      <p className="eyebrow mb-3 text-wine-300">One-time setup needed</p>
      <p>
        The cinema needs a free Supabase project for real-time sync. Copy <code className="text-wine-300">.env.example</code> to{" "}
        <code className="text-wine-300">.env.local</code>, add your Supabase URL and anon key, run{" "}
        <code className="text-wine-300">supabase/schema.sql</code> in the Supabase SQL editor, then restart the app.
      </p>
      <p className="mt-3 text-cream/50">The README walks through it step by step (about 5 minutes).</p>
    </div>
  );
}
