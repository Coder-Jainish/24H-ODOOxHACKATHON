export default function Placeholder({ title, desc }) {
  return (
    <div>
      <h1>{title}</h1>
      <p className="muted">{desc || "This feature is coming in a later phase."}</p>
    </div>
  );
}
