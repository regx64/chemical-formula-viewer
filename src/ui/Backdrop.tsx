export function Backdrop() {
  return (
    <>
      <div className="backdrop" aria-hidden>
        <div className="grid" />
        <div className="orb a" />
        <div className="orb b" />
        <div className="orb c" />
      </div>
      <div className="grain" aria-hidden />
    </>
  );
}
