/** Inline error banner — used by /dashboard when the API is unreachable */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center gap-6 px-4 py-20 text-center md:px-8 xl:px-12">
      {/* Pulsing indicator */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF3831] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF3831]" />
      </span>
      <div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.5em] text-zinc-300">
          System Status · Data Pipeline
        </p>
        <p className="font-serif text-2xl font-black text-white">
          AWAITING BACKEND CONNECTION
        </p>
        <p className="mt-3 mx-auto max-w-sm font-mono text-sm leading-relaxed text-zinc-300">
          The SPECTRAVEIN intelligence pipeline is unreachable.
          Ensure the FastAPI server is running on{' '}
          <span className="text-zinc-300">
            {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
          </span>
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-300">ERR: {message}</p>
      </div>
    </div>
  );
}
