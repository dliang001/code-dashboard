import { useParams, Link } from "react-router-dom";

export default function Detail() {
  const params = useParams<{ id: string; "*": string }>();
  const splat = params["*"] ?? "";
  const id = splat ? `${params.id}/${splat}` : (params.id ?? "");
  return (
    <main className="p-5">
      <Link to="/" className="text-sm text-blue-600 hover:underline">← 返回</Link>
      <p className="mt-3 text-gray-500">Detail for <code>{id}</code> coming in Task 8.</p>
    </main>
  );
}
