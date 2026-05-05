interface Props {
  title: string;
  body?: string;
}

export function EmptyState({ title, body }: Props) {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">📁</div>
      <h2 className="font-semibold mb-1">{title}</h2>
      {body && <p className="text-sm text-gray-500">{body}</p>}
    </div>
  );
}
