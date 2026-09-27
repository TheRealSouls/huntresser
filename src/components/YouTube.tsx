export function YouTube({ id, title }: { id: string; title: string }) {
  return (
    <div className="aspect-video overflow-hidden rounded-sm border border-line bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        className="h-full w-full"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
