import Link from "next/link";

/** Khung placeholder cho các màn hình nghiệp vụ sẽ xây ở các pha sau. */
export function PlaceholderPage({
  icon,
  title,
  pha,
  note,
}: {
  icon: string;
  title: string;
  pha: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <div className="text-4xl">{icon}</div>
      <h1 className="mt-3 text-lg font-semibold">{title}</h1>
      <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-500">
        {pha} — sẽ triển khai sau
      </span>
      <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">{note}</p>
      <Link
        href="/"
        className="mt-5 inline-block text-sm text-brand hover:underline"
      >
        ← Về trang chủ
      </Link>
    </div>
  );
}
