import { setLanguageAction } from "@/app/actions";
import { getLocale } from "@/lib/i18n";

/** English / اردو, each written in its own language so anyone can find theirs. */
export async function LanguageSwitch() {
  const locale = await getLocale();
  const options = [
    ["en", "English"],
    ["ur", "اردو"],
  ] as const;
  return (
    <div className="flex justify-center gap-2 text-sm">
      {options.map(([value, label]) => (
        <form key={value} action={setLanguageAction.bind(null, value)}>
          <button
            type="submit"
            aria-pressed={locale === value}
            className={`rounded-full px-3 py-1 ${
              locale === value
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}
