export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="max-w-2xl text-muted-foreground">{description}</p> : null}
    </div>
  );
}
